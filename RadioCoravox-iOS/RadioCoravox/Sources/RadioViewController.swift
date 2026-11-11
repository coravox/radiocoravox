import AVFoundation
import MediaPlayer
import SafariServices
import UIKit
import WebKit

final class RadioViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    private var webView: WKWebView!
    private let radio = RadioPlayer()
    private var currentSong = "Radio Coravox en vivo"

    override func loadView() {
        let controller = WKUserContentController()
        controller.add(self, name: "coravox")
        let hook = """
        (function() {
          function install() {
            if (window.__coravoxIOSHook) return;
            window.__coravoxIOSHook = true;
            window.CoravoxPlayback = window.CoravoxPlayback || {};
            window.CoravoxPlayback.openSubscription = function(url) {
              window.webkit.messageHandlers.coravox.postMessage({type:'open', url:String(url)});
              return true;
            };
            window.CoravoxPlayback.shareApp = function(eventId) {
              window.webkit.messageHandlers.coravox.postMessage({type:'share', eventId:String(eventId || '')});
              return true;
            };
            window.CoravoxPlayback.reportShareDiagnostic = function(stage) {
              window.webkit.messageHandlers.coravox.postMessage({type:'shareDiagnostic', stage:String(stage || '')});
            };
            window.CoravoxPlayback.beginGreetingRecording = function() {
              window.webkit.messageHandlers.coravox.postMessage({type:'micStart'});
            };
            window.CoravoxPlayback.endGreetingRecording = function() {
              window.webkit.messageHandlers.coravox.postMessage({type:'micStop'});
            };
            document.addEventListener('click', function(event) {
              var button = event.target && event.target.closest ? event.target.closest('#btnPlay') : null;
              if (!button) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              window.webkit.messageHandlers.coravox.postMessage({type:'toggle'});
            }, true);
          }
          install();
          document.addEventListener('DOMContentLoaded', install, {once:true});
        })();
        """
        controller.addUserScript(WKUserScript(source: hook, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.bounces = false
        webView = view
        self.view = view
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        radio.onStateChange = { [weak self] playing, message in
            guard let self else { return }
            self.updateWebPlaybackState(playing: playing, message: message)
        }
        radio.onMetadata = { [weak self] title, artist in
            guard let self else { return }
            self.currentSong = [artist, title].filter { !$0.isEmpty }.joined(separator: " — ")
            self.radio.updateNowPlaying(title: title, artist: artist)
        }
        radio.configureRemoteControls()
        guard let webDirectory = Bundle.main.url(forResource: "Web", withExtension: nil),
              let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else {
            showLoadError()
            return
        }
        webView.loadFileURL(page, allowingReadAccessTo: webDirectory)
    }

    private func showLoadError() {
        let label = UILabel()
        label.text = "No se pudieron cargar los recursos de Radio Coravox."
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.frame = view.bounds.insetBy(dx: 24, dy: 24)
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(label)
    }

    private func updateWebPlaybackState(playing: Bool, message: String) {
        let safeMessage = Self.javascriptString(message)
        let script = """
        (function(){
          var b=document.getElementById('btnPlay');
          if(b) b.textContent=\(playing ? "'⏸ Pausar'" : "'▶ Escuchar'");
          var s=document.getElementById('status');
          if(s) s.textContent=\(safeMessage);
          document.body.classList.toggle('playing', \(playing ? "true" : "false"));
        })();
        """
        DispatchQueue.main.async { self.webView.evaluateJavaScript(script) }
    }

    private static func javascriptString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [value], options: [.fragmentsAllowed]),
              let encoded = String(data: data, encoding: .utf8), encoded.count >= 2 else { return "\"\"" }
        return String(encoded.dropFirst().dropLast())
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "toggle":
            if radio.isPlaying { radio.pause() } else { radio.play() }
        case "open":
            if let text = body["url"] as? String, let url = URL(string: text) { openExternal(url) }
        case "share":
            presentShare(eventId: body["eventId"] as? String ?? "")
        case "shareDiagnostic":
            NSLog("Radio Coravox share diagnostic: %@", body["stage"] as? String ?? "")
        case "micStart":
            radio.setRecordingMode(true)
        case "micStop":
            radio.setRecordingMode(false)
        default:
            break
        }
    }

    private func openExternal(_ url: URL) { present(SFSafariViewController(url: url), animated: true) }

    private func presentShare(eventId: String) {
        let text = "Escucha Radio Coravox en vivo. Música, chat y buena compañía."
        let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        sheet.completionWithItemsHandler = { [weak self] activity, completed, _, _ in
            guard completed, let activity else { return }
            let label = activity.rawValue.components(separatedBy: ".").last ?? activity.rawValue
            let event = Self.javascriptString(eventId)
            let destination = Self.javascriptString(label)
            let script = "window.coravoxShareDestinationChosen && window.coravoxShareDestinationChosen(\(event), \(destination));"
            DispatchQueue.main.async { self?.webView.evaluateJavaScript(script) }
        }
        if let popover = sheet.popoverPresentationController {
            popover.sourceView = webView
            popover.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
        }
        present(sheet, animated: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        if url.isFileURL || url.host == "a13.my-control-panel.com" || url.host == "www.gstatic.com" ||
            url.host == "firebasestorage.googleapis.com" || url.host?.hasSuffix(".firebaseio.com") == true ||
            url.host?.hasSuffix(".googleapis.com") == true {
            decisionHandler(.allow)
            return
        }
        if navigationAction.navigationType == .linkActivated {
            openExternal(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { openExternal(url) }
        return nil
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(type == .microphone ? .grant : .deny)
    }
}

private final class RadioPlayer {
    private let streamURL = URL(string: "https://a13.my-control-panel.com/listen/radio_coravox/radio.mp3")!
    private let metadataURL = URL(string: "https://a13.my-control-panel.com/api/nowplaying/radio_coravox")!
    private var player: AVPlayer?
    private var itemObservation: NSKeyValueObservation?
    private var timeObservation: NSKeyValueObservation?
    private var retryWork: DispatchWorkItem?
    private var metadataTimer: Timer?
    private var retryCount = 0
    private var shouldResumeAfterInterruption = false
    var onStateChange: ((Bool, String) -> Void)?
    var onMetadata: ((String, String) -> Void)?
    var isPlaying: Bool { player?.timeControlStatus == .playing }

    init() {
        NotificationCenter.default.addObserver(self, selector: #selector(handleInterruption(_:)), name: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance())
        NotificationCenter.default.addObserver(self, selector: #selector(handleStall(_:)), name: .AVPlayerItemPlaybackStalled, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleFailure(_:)), name: .AVPlayerItemFailedToPlayToEndTime, object: nil)
    }

    func play() {
        retryWork?.cancel()
        retryCount = 0
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            onStateChange?(false, "No se pudo activar el audio.")
            return
        }
        startStream()
    }

    func pause() {
        retryWork?.cancel()
        player?.pause()
        metadataTimer?.invalidate()
        metadataTimer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        onStateChange?(false, "Radio pausada.")
    }

    func setRecordingMode(_ recording: Bool) {
        do {
            let session = AVAudioSession.sharedInstance()
            if recording {
                try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
                try session.setActive(true)
            } else {
                try session.setCategory(.playback, mode: .default, options: [])
                if isPlaying { try session.setActive(true) }
                else { try session.setActive(false, options: .notifyOthersOnDeactivation) }
            }
        } catch {
            NSLog("Radio Coravox: no se pudo cambiar la sesión del micrófono: %@", error.localizedDescription)
        }
    }

    private func startStream() {
        onStateChange?(false, retryCount == 0 ? "Conectando con Radio Coravox…" : "Reconectando con Radio Coravox…")
        itemObservation = nil
        timeObservation = nil
        let item = AVPlayerItem(url: streamURL)
        let newPlayer = AVPlayer(playerItem: item)
        newPlayer.automaticallyWaitsToMinimizeStalling = true
        player = newPlayer
        itemObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            if item.status == .failed { self?.scheduleRetry() }
        }
        timeObservation = newPlayer.observe(\.timeControlStatus, options: [.initial, .new]) { [weak self] player, _ in
            guard let self else { return }
            if player.timeControlStatus == .playing {
                self.retryCount = 0
                self.onStateChange?(true, "Conectado: Radio Coravox en vivo.")
                self.refreshNowPlaying()
                self.beginMetadataPolling()
            }
        }
        newPlayer.play()
    }

    private func beginMetadataPolling() {
        metadataTimer?.invalidate()
        refreshNowPlaying()
        metadataTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in self?.refreshNowPlaying() }
    }

    private func refreshNowPlaying() {
        URLSession.shared.dataTask(with: metadataURL) { [weak self] data, _, error in
            guard let self, error == nil, let data,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let now = root["now_playing"] as? [String: Any],
                  let song = now["song"] as? [String: Any] else { return }
            let title = song["title"] as? String ?? song["text"] as? String ?? ""
            let artist = song["artist"] as? String ?? ""
            DispatchQueue.main.async { self.onMetadata?(title, artist) }
        }.resume()
    }

    func updateNowPlaying(title: String, artist: String = "Radio Coravox") {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title.isEmpty ? "Radio Coravox en vivo" : title,
            MPMediaItemPropertyArtist: artist.isEmpty ? "Radio Coravox" : artist,
            MPMediaItemPropertyAlbumTitle: "Radio Coravox",
            MPNowPlayingInfoPropertyIsLiveStream: true,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    func configureRemoteControls() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in self?.play(); return .success }
        center.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            self.isPlaying ? self.pause() : self.play()
            return .success
        }
        updateNowPlaying(title: "Radio Coravox en vivo")
    }

    private func scheduleRetry() {
        guard player != nil else { return }
        retryWork?.cancel()
        retryCount += 1
        let delay = min(pow(2.0, Double(min(retryCount, 5))), 30.0)
        onStateChange?(false, "Se perdió la señal. Reintentando…")
        let work = DispatchWorkItem { [weak self] in self?.startStream() }
        retryWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    @objc private func handleStall(_ note: Notification) {
        if let item = note.object as? AVPlayerItem, item === player?.currentItem { scheduleRetry() }
    }
    @objc private func handleFailure(_ note: Notification) {
        if let item = note.object as? AVPlayerItem, item === player?.currentItem { scheduleRetry() }
    }
    @objc private func handleInterruption(_ note: Notification) {
        guard let info = note.userInfo,
              let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .began {
            shouldResumeAfterInterruption = isPlaying
            player?.pause()
            onStateChange?(false, "Audio interrumpido.")
        } else if type == .ended {
            let options = AVAudioSession.InterruptionOptions(rawValue: info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
            if shouldResumeAfterInterruption && options.contains(.shouldResume) { play() }
        }
    }
}
