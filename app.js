
  /* ======== CONFIG ======== */
  var STREAM_URL = "https://a13.my-control-panel.com/listen/radio_coravox/radio.mp3";
  var META_URL   = "https://a13.my-control-panel.com/api/nowplaying/radio_coravox";

  var SUPER_FANS_URL = "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-02N26347CY290173YNFQSTTY";
  var DONATE_URL     = "https://www.paypal.com/donate/?hosted_button_id=7W9NHUDF5X3WG";

  var CASHAPP_URL = "https://cash.app/coravox";
  var ZELLE_EMAIL = "vis-party@hotmail.com";
  var BTC_ADDRESS = "3QYuSZarVNTgHuo9UmPxWMmxLgeWyu9Juo";

  var PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.radiocoravox.app";

  /* ======== Firebase (ARREGLADO) ======== */
  var firebaseConfig = {
    apiKey: "AIzaSyC8jq2iODj6DwfTSktgZ7ia84oeMxxPjNE",
    authDomain: "coravox-602a0.firebaseapp.com",
    projectId: "coravox-602a0",
    storageBucket: "coravox-602a0.firebasestorage.app",
    messagingSenderId: "629472102664",
    appId: "1:629472102664:web:56e539689983458ada84bd"
  };
  var auth = null;
  var firebaseBootstrapStarted = false;
  var authSignInInFlight = false;
  var resolveFirebaseReady;
  window.rcxFirebaseReady = new Promise(function(resolve){ resolveFirebaseReady = resolve; });

  // ✅ refs globales (se asignan DESPUÉS del login anónimo)
  var db = null;
  var messagesRef = null;
  var likesRef = null;
  var presenceRef = null;
  var cfgRef = null;

  // ======== UI ========
  var audio = document.getElementById("player");
  var btnPlay = document.getElementById("btnPlay");
  var statusText = document.getElementById("status");
  var listenersLabel = document.getElementById("listenersLabel");
  var songLabel = document.getElementById("songLabel");
  var likeRankingBox = document.getElementById("likeRanking");
  var chatBox = document.getElementById("chatBox");
  var chatInput = document.getElementById("chatInput");
  var chatSend = document.getElementById("chatSend");

  var superFansBtn = document.getElementById("superFansBtn");
  var superFansOverlay = document.getElementById("superFansOverlay");
  var superFansClose = document.getElementById("superFansClose");
  var superFansSubscribe = document.getElementById("superFansSubscribe");
  var superFansCheckoutPending = false;

  var loveOverlay = document.getElementById("loveOverlay");
  var closeLove = document.getElementById("closeLove");

  var payPaypal = document.getElementById("payPaypal");
  var payCashApp = document.getElementById("payCashApp");
  var payZelle = document.getElementById("payZelle");
  var payBtc = document.getElementById("payBtc");

  var btnShare = document.getElementById("btnShare");
  var shareOverlay = document.getElementById("shareOverlay");
  var shareClose = document.getElementById("shareClose");
  var shareNativeButton = document.getElementById("shareNativeButton");
  var shareCopyButton = document.getElementById("shareCopyButton");
  var shareStatus = document.getElementById("shareStatus");
  var announcedShareEvents = Object.create(null);
  var pendingShareNotices = [];
  var btnGift = document.getElementById("btnGift");
  var btnName = document.getElementById("btnName");

  var nameOverlay = document.getElementById("nameOverlay");
  var nameInput = document.getElementById("nameInput");
  var nameOk = document.getElementById("nameOk");

  var pinOverlay = document.getElementById("pinOverlay");
  var pinInput = document.getElementById("pinInput");
  var pinOk = document.getElementById("pinOk");
  var pinError = document.getElementById("pinError");

  /* ======== Colores por usuario ======== */
  var colorPalette = ["#f5c85b","#ff7ad9","#7ad9ff","#9dff7a","#ffb27a","#c7a6ff","#ff6b6b"];
  var userColors = {};

  function hashString(str){
    var h=0;
    for (var i=0;i<str.length;i++){
      h = (h<<5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
  function getColorForUser(user){
    if(!user) user="Oyente";
    if(userColors[user]) return userColors[user];
    var idx = hashString(user) % colorPalette.length;
    userColors[user] = colorPalette[idx];
    return userColors[user];
  }

  /* ======== Admin / Nick ======== */
  var ADMIN_NAME="Coravox";
  var nickname=null;
  var isAdmin=false;

  function setStatus(t){ if(statusText) statusText.textContent=t; }

  function applyNickname(nm){
    nickname = (nm && nm.trim()) ? nm.trim() : "Oyente";
    if(nickname.toLowerCase() === ADMIN_NAME.toLowerCase()) nickname = "Oyente";
    // La web pública no concede privilegios administrativos desde código cliente.
    isAdmin = false;
    try{
      localStorage.setItem("rcx_nickname", nickname);
      localStorage.setItem("rcx_is_admin", "0");
    }catch(e){}
    // ✅ ping si ya está listo
    pingPresence();
  }

  async function sendJoinMessage(name) {
    try {
      if(!messagesRef) return;
      await messagesRef.add({
        usuario: "Sistema",
        mensaje: "👋 " + name + " se conectó.",
        rol: "system",
        tipo: "system",
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.log("join msg error", e);}
  }

  (function(){
    try{
      var stored = localStorage.getItem("rcx_nickname");
      if(stored){
        applyNickname(stored);
      } else {
        nameOverlay.style.display="flex";
      }
    }catch(e){
      nameOverlay.style.display="flex";
    }
  })();

  nameOk.addEventListener("click", function(){
    var val=(nameInput.value||"Oyente").trim();
    if(!val) val="Oyente";

    if(val.toLowerCase()===ADMIN_NAME.toLowerCase()){
      nameInput.setCustomValidity("Ese nombre está reservado para el administrador.");
      nameInput.reportValidity();
      return;
    }
    nameInput.setCustomValidity("");
    applyNickname(val);
    nameOverlay.style.display="none";
    sendJoinMessage(nickname || "Oyente");
  });

  btnName.addEventListener("click", function(){
    nameOverlay.style.display="flex";
  });

  /* ======== Audio ======== */
  var isPlaying=false;
  btnPlay.addEventListener("click", async function(e){
    e.preventDefault();
    try{
      if(!isPlaying){
        var url = STREAM_URL + "?t=" + Date.now();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audio.src = url;

        setStatus("Conectando con Radio Coravox…");
        var p=audio.play();
        if(p) await p;

        isPlaying=true;
        btnPlay.textContent="⏸ Pausar";
        setStatus("Conectado: Radio Coravox en vivo.");
        document.body.classList.add("playing");
      } else {
        audio.pause();
        isPlaying=false;
        btnPlay.textContent="▶ Escuchar";
        setStatus("Pausado.");
        document.body.classList.remove("playing");
      }
    }catch(err){
      console.log(err);
      setStatus("Error al conectar con el streaming.");
      isPlaying=false;
      btnPlay.textContent="▶ Escuchar";
      document.body.classList.remove("playing");
    }
  });

  function updateMeta(){
    fetch(META_URL).then(r=>r.json()).then(function(data){
      var listeners=(data.listeners && data.listeners.current) ? data.listeners.current : 0;
      var title="—";
      if (data.now_playing && data.now_playing.song){
        var s=data.now_playing.song;
        title=(s.title && s.title.trim()!=="") ? s.title : (s.text || "—");
      }
      var parts=title.split(" - ");
      if(parts.length>1) title=parts[parts.length-1].trim();

      listenersLabel.textContent="👥 Oyentes: " + listeners;
      songLabel.textContent="🎵 Ahora suena: " + title;
    }).catch(()=>{});
  }
  updateMeta();
  setInterval(updateMeta,15000);

  /* ========= Presence (ARREGLADO: sin usar db antes de tiempo) ========= */
  var presenceBtn = document.getElementById("presenceBtn");
  var presenceOverlay = document.getElementById("presenceOverlay");
  var presenceClose = document.getElementById("presenceClose");
  var presenceList = document.getElementById("presenceList");

  function getSessionId() {
    try {
      var s = localStorage.getItem("rcx_session_id");
      if (s) return s;
      s = "s_" + Math.random().toString(36).slice(2) + "_" + Date.now();
      localStorage.setItem("rcx_session_id", s);
      return s;
    } catch (e) {
      return "s_" + Math.random().toString(36).slice(2) + "_" + Date.now();
    }
  }
  var sessionId = getSessionId();

  function ensureAnonymousSignIn(){
    if(!auth || auth.currentUser || authSignInInFlight) return;
    authSignInInFlight = true;
    auth.signInAnonymously().catch(function(e){
      console.warn("Radio Coravox: Firebase Auth aún no está disponible; se reintentará.", e.code || e.message || e);
      window.setTimeout(ensureAnonymousSignIn, 15000);
    }).finally(function(){ authSignInInFlight = false; });
  }

  var presenceDoc = null; // ✅ se crea cuando presenceRef esté listo

  var PRESENCE_TTL_MS = 45000;
  var PRESENCE_PING_MS = 20000;

  async function pingPresence() {
    try {
      if(!presenceDoc) return;
      var name = nickname || "Oyente";
      await presenceDoc.set({
        name: name,
        admin: !!isAdmin,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.log("presence ping error", e);
    }
  }

  function renderPresence(docs) {
    var now = Date.now();
    var online = [];

    docs.forEach(function(d) {
      var data = d.data() || {};
      var ts = data.lastSeen;
      var ms = 0;
      try { if (ts && typeof ts.toMillis === "function") ms = ts.toMillis(); } catch(e) {}

      if (ms && (now - ms) <= PRESENCE_TTL_MS) {
        online.push({
          id: d.id,
          name: data.name || "Oyente",
          admin: !!data.admin,
          ms: ms
        });
      }
    });

    online.sort(function(a,b){ return b.ms - a.ms; });

    if (presenceBtn) presenceBtn.textContent = "Conectados: " + online.length;

    if (presenceList) {
      presenceList.innerHTML = "";
      if (online.length === 0) {
        presenceList.innerHTML = "<div style='opacity:.85;padding:10px 0;'>Nadie conectado aún.</div>";
        return;
      }

      online.forEach(function(u) {
        var row = document.createElement("div");
        row.className = "presenceItem";

        var left = document.createElement("div");
        left.className = "presenceNameRow";

        var dot = document.createElement("div");
        dot.className = "presenceDot";

        var nm = document.createElement("div");
        nm.className = "presenceName";
        nm.textContent = u.name;

        left.appendChild(dot);
        left.appendChild(nm);

        var right = document.createElement("div");
        if (u.admin) {
          right.className = "presenceBadge";
          right.textContent = "ADMIN";
        } else {
          right.textContent = "";
        }

        row.appendChild(left);
        row.appendChild(right);
        presenceList.appendChild(row);
      });
    }
  }

  if (presenceBtn) {
    presenceBtn.addEventListener("click", function(e){
      e.preventDefault(); e.stopPropagation();
      if (!presenceOverlay) return;
      presenceOverlay.style.display = "flex";
    }, true);
  }
  if (presenceClose) {
    presenceClose.addEventListener("click", function(){
      if (presenceOverlay) presenceOverlay.style.display = "none";
    }, true);
  }
  if (presenceOverlay) {
    presenceOverlay.addEventListener("click", function(e){
      if (e.target && e.target.id === "presenceOverlay") {
        presenceOverlay.style.display = "none";
      }
    }, true);
  }

  document.addEventListener("visibilitychange", function() {
    if (!document.hidden) {
      if(superFansCheckoutPending){
        superFansCheckoutPending = false;
        closeSuperFansModal();
      }
      pingPresence();
    }
  });

  /* ======== Chat ======== */
  function renderChat(docs){
    chatBox.innerHTML="";
    var info=document.createElement("div");
    info.className="chatInfo";
    info.textContent="Chat en vivo";
    chatBox.appendChild(info);

    docs.forEach(function(d){
      if(isAutomaticWelcomeMessage(d)) return;
      if(isTechnicalLegacyShareNotice(d)) return;
      var line=document.createElement("div");
      line.className="chatLine";

      if(d.tipo==="system"){
        line.classList.add("chatSys");
        if(d.avisoCompartir===true) line.style.color="#fff";
        line.textContent=d.mensaje || "";
      } else {
        var name=(d.usuario||"Oyente");
        var msg=(d.mensaje||"");
        var spanName=document.createElement("span");
        spanName.className="chatUserName"+((d.rol==="admin")?" admin":"");
        spanName.textContent=name+":";
        if(d.rol!=="admin"){
          spanName.style.color = getColorForUser(name);
        }

        var spanMsg=document.createElement("span");
        spanMsg.textContent=" "+msg;

        line.appendChild(spanName);
        line.appendChild(spanMsg);
      }
      chatBox.appendChild(line);
    });
    chatBox.scrollTop=chatBox.scrollHeight;
  }

  function normalizeChatMessage(value){
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function isAutomaticWelcomeMessage(doc){
    if(!doc) return false;
    var author=normalizeChatMessage(doc.usuario || "");
    var message=normalizeChatMessage(doc.mensaje || "");
    var systemMessage=doc.tipo === "system" || doc.rol === "system";
    var welcomeBody="para escuchar radio coravox toca el boton escuchar";
    var welcomeFull="radio coravox para escuchar radio coravox toca el boton escuchar";
    var botAuthor=author.indexOf("radio coravox")===0;
    return (botAuthor || systemMessage) &&
      (message.indexOf(welcomeBody)===0 || message.indexOf(welcomeFull)===0);
  }

  function isTechnicalLegacyShareNotice(doc){
    if(!doc || doc.tipo!=="system") return false;
    var message=String(doc.mensaje || "");
    var prefix="📲❤️ ";
    var suffix=" para compartir Radio Coravox.";
    if(message.indexOf(prefix)!==0 || message.slice(-suffix.length)!==suffix) return false;
    var body=message.slice(prefix.length, -suffix.length);
    var separator=" eligió ";
    var splitAt=body.lastIndexOf(separator);
    if(splitAt<0) return false;
    var destination=body.slice(splitAt+separator.length).trim();
    return /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_-]+)+$/.test(destination);
  }

  function renderTopFans(items){
    likeRankingBox.innerHTML="";
    var title=document.createElement("div");
    title.className="likeTitle";
    title.textContent="TOP FANS ❤";
    likeRankingBox.appendChild(title);
    items.forEach(function(item, index){
      var row=document.createElement("div");
      row.className="likeRow";
      var name=document.createElement("span");
      name.className="likeName";
      name.textContent=(index+1)+". "+item.usuario;
      var count=document.createElement("span");
      count.className="likeCount";
      count.textContent=String(item.likes || 0);
      row.appendChild(name);
      row.appendChild(count);
      likeRankingBox.appendChild(row);
    });
  }


  /* ======== TAP TAP PRUEBA 1 ======== */
var tapTapsRef = null;

function publishTapTap(){
  if(!tapTapsRef){
    console.log("TAP TAP: referencia no lista");
    return;
  }

  tapTapsRef.add({
    senderId: firebase.auth().currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(doc){
    console.log("❤️ TAP TAP enviado:", doc.id);
  }).catch(function(e){
    console.error("❌ TAP TAP error:", e);
  });
}

  /* ======== Likes tap-tap ======== */
  function registerLike(){
    if(!likesRef) return;
    var user = nickname || "Oyente";
    likesRef.doc(user).set({
      usuario:user,
      likes: firebase.firestore.FieldValue.increment(1),
      updated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge:true }).catch(function(e){ console.log("like error", e); });
  }

  function spawnHeartAt(x,y){
    var h=document.createElement("div");
    h.className="heart";
    h.textContent="❤";
    h.style.left=x+"px";
    h.style.top=y+"px";
    document.body.appendChild(h);
    registerLike();
    publishTapTap();
    setTimeout(()=>{ if(h.parentNode) h.parentNode.removeChild(h); }, 1700);
  }

  document.addEventListener("click", function(e){
    if (e.target.closest && (
      e.target.closest("#bottomBar") ||
      e.target.closest("#nameOverlay") ||
      e.target.closest("#pinOverlay") ||
      e.target.closest("#loveOverlay") ||
      e.target.closest("#superFansOverlay") ||
      e.target.closest("#requestOverlay") ||
      e.target.closest("#controls") ||
      e.target.closest("#fansActions") ||
      e.target.closest("#presenceOverlay") ||
      e.target.closest("#presenceBtn")
    )) return;

    var tag=(e.target.tagName||"").toLowerCase();
    if(tag==="button" || tag==="input" || tag==="iframe") return;

    spawnHeartAt(e.clientX, e.clientY);
  }, true);

  /* ======== Admin commands ======== */
  async function resetTopFans() {
    try {
      if(!likesRef || !messagesRef || !db) return;
      const snap = await likesRef.get();
      const batch = db.batch();
      snap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      await messagesRef.add({
        usuario: "Sistema",
        mensaje: "✅ TOP FANS reiniciado por Coravox.",
        rol: "system",
        tipo: "system",
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.log("resetfans error:", err);
    }
  }

  async function clearChat() {
    try {
      if(!messagesRef || !db) return;
      const snap = await messagesRef.get();
      const batch = db.batch();
      snap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      await messagesRef.add({
        usuario: "Sistema",
        mensaje: "🧹 Chat limpiado por Coravox.",
        rol: "system",
        tipo: "system",
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.log("clearchat error:", err);
    }
  }

  async function sendMessage(){
    var t = (chatInput.value || "").trim();
    if (!t) return;

    if (isAdmin) {
      var lower = t.toLowerCase();
      if (lower === "resetfans" || lower === "/resetfans") {
        chatInput.value = "";
        await resetTopFans();
        return;
      }
      if (lower === "clearchat" || lower === "/clearchat") {
        chatInput.value = "";
        await clearChat();
        return;
      }
    }

    chatInput.value = "";
    if(!messagesRef) return;

    messagesRef.add({
      usuario: nickname || "Oyente",
      mensaje: t,
      rol: isAdmin ? "admin" : "user",
      tipo: "mensaje",
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  chatSend.addEventListener("click", function(e){ e.preventDefault(); sendMessage(); });
  chatInput.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); sendMessage(); } });

  /* ======== Compartir Radio Coravox ======== */
  function closeShareModal(){
    shareOverlay.style.display="none";
    shareOverlay.setAttribute("aria-hidden", "true");
  }

  function shareInvitationText(){
    return "❤️📻 ¡Te invito a escuchar Radio Coravox!\n\n"+
      "🎶 Música romántica, rancheras y banda para acompañarte dondequiera que estés.\n\n"+
      "📲 Descarga nuestra aplicación gratis en Google Play:\n"+PLAY_STORE_URL;
  }

  btnShare.addEventListener("click", function(){
    shareStatus.textContent="";
    shareOverlay.style.display="flex";
    shareOverlay.setAttribute("aria-hidden", "false");
    shareClose.focus();
  });

  shareClose.addEventListener("click", closeShareModal);
  shareOverlay.addEventListener("click", function(event){
    if(event.target===shareOverlay) closeShareModal();
  });
  window.addEventListener("keydown", function(event){
    if(event.key==="Escape" && shareOverlay.style.display==="flex") closeShareModal();
  });

  shareNativeButton.addEventListener("click", function(){
    var eventId="share-"+Date.now()+"-"+Math.random().toString(36).slice(2,10);
    var invitation=shareInvitationText();
    if(window.CoravoxPlayback && typeof window.CoravoxPlayback.shareApp==="function"){
      shareStatus.textContent="Elige una aplicación en el selector de Android.";
      if(!window.CoravoxPlayback.shareApp(eventId)){
        shareStatus.textContent="No se pudo abrir el selector de aplicaciones.";
      }
      return;
    }
    if(navigator.share){
      navigator.share({title:"Radio Coravox", text:invitation}).catch(function(error){
        if(error && error.name!=="AbortError") console.log("share error:", error);
      });
      return;
    }
    shareStatus.textContent="Este navegador no ofrece el selector. Copia el enlace para compartirlo.";
  });

  async function copyStoreLink(){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(PLAY_STORE_URL);
      } else {
        var temporaryInput=document.createElement("textarea");
        temporaryInput.value=PLAY_STORE_URL;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position="fixed";
        temporaryInput.style.opacity="0";
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        var copied=document.execCommand("copy");
        temporaryInput.remove();
        if(!copied) throw new Error("clipboard unavailable");
      }
      shareStatus.textContent="Enlace copiado. Copiarlo no publica un aviso en el chat.";
    }catch(error){
      console.log("copy link error:", error);
      shareStatus.textContent="No se pudo copiar. Mantén pulsado el enlace para copiarlo.";
    }
  }
  shareCopyButton.addEventListener("click", copyStoreLink);

  function reportShareDiagnostic(stage){
    try{
      if(window.CoravoxPlayback && typeof window.CoravoxPlayback.reportShareDiagnostic==="function"){
        window.CoravoxPlayback.reportShareDiagnostic(stage);
      }
    }catch(error){ console.warn("share diagnostic bridge unavailable"); }
  }

  function postShareNotice(notice){
    if(!messagesRef){
      pendingShareNotices.push(notice);
      reportShareDiagnostic("firebase_queued_waiting_for_ref");
      return;
    }
    messagesRef.add({
      usuario:"Sistema",
      mensaje:"📲❤️ "+notice.name+" eligió "+notice.destination+" para compartir Radio Coravox.",
      rol:"system",
      tipo:"system",
      avisoCompartir:true,
      creado:firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
      reportShareDiagnostic("firebase_accepted");
    }).catch(function(error){
      var code=(error && error.code ? String(error.code) : "unknown").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0,32);
      reportShareDiagnostic("firebase_rejected_"+code);
      console.log("share notice error:", error);
    });
  }

  function flushPendingShareNotices(){
    if(!messagesRef || !pendingShareNotices.length) return;
    var notices=pendingShareNotices.splice(0);
    notices.forEach(postShareNotice);
  }

  window.coravoxShareDestinationChosen=function(eventId, appLabel){
    if(!eventId) return "rejected_missing_event";
    if(announcedShareEvents[eventId]) return "ignored_duplicate";
    closeShareModal();

    var destination=(typeof appLabel==="string" ? appLabel : "").trim();
    if(!destination || destination.length>60 || /[\u0000-\u001f\u007f]/.test(destination) ||
       /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_-]+)+$/.test(destination)){
      console.log("share notice skipped: no reliable readable app name");
      return "rejected_unreadable_label";
    }

    var savedName="";
    try{ savedName=(nickname || localStorage.getItem("rcx_nickname") || "").trim(); }catch(error){}
    if(!savedName){
      console.log("share notice skipped: no saved listener name");
      return "rejected_no_saved_name";
    }
    announcedShareEvents[eventId]=true;
    postShareNotice({eventId:eventId, name:savedName, destination:destination});
    return messagesRef ? "submitted_to_firebase" : "queued_for_firebase";
  };

  window.coravoxShareLaunchFailed=function(){
    shareStatus.textContent="No se pudo abrir el selector de aplicaciones.";
  };

  btnGift.addEventListener("click", function(){
    loveOverlay.style.display="flex";
  });

  superFansBtn.addEventListener("click", function(){
    superFansOverlay.style.display="flex";
    superFansOverlay.setAttribute("aria-hidden", "false");
    superFansClose.focus();
  });

  function closeSuperFansModal(){
    superFansOverlay.style.display="none";
    superFansOverlay.setAttribute("aria-hidden", "true");
    superFansBtn.focus();
  }
  superFansClose.addEventListener("click", closeSuperFansModal);
  superFansOverlay.addEventListener("click", function(e){
    if(e.target === superFansOverlay) closeSuperFansModal();
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && superFansOverlay.style.display === "flex"){
      closeSuperFansModal();
    }
  });
  superFansSubscribe.addEventListener("click", function(e){
    e.preventDefault();
    e.stopPropagation();
    var opened = false;
    try{
      if(window.CoravoxPlayback && typeof window.CoravoxPlayback.openSubscription === "function" &&
         window.CoravoxPlayback.openSubscription(SUPER_FANS_URL)) opened = true;
    }catch(err){}
    if(!opened){
      var checkout = window.open(SUPER_FANS_URL, "_blank");
      if(checkout){
        checkout.opener = null;
        opened = true;
      }
    }
    if(opened) superFansCheckoutPending = true;
    else setStatus("No se pudo abrir PayPal. Inténtalo de nuevo.");
  });

  /* ======== Pagos ======== */
  function copyToClipboardWebView(text, okMsg){
    try{
      var ta=document.createElement("textarea");
      ta.value=text;
      ta.setAttribute("readonly","");
      ta.style.position="fixed";
      ta.style.left="-9999px";
      ta.style.top="0";
      ta.style.opacity="0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok=false;
      try{ ok=document.execCommand("copy"); }catch(e){ ok=false; }
      document.body.removeChild(ta);
      if(ok) alert(okMsg);
      else prompt("Copia manualmente:", text);
    }catch(e){
      prompt("Copia manualmente:", text);
    }
  }

  payPaypal.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    window.location.href = DONATE_URL;
  }, true);

  payCashApp.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    window.location.href = CASHAPP_URL;
  }, true);

  payZelle.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    copyToClipboardWebView(ZELLE_EMAIL, "💙 Correo Zelle copiado:\n" + ZELLE_EMAIL);
  }, true);

  payBtc.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    copyToClipboardWebView(BTC_ADDRESS, "🧡 Dirección Bitcoin copiada:\n" + BTC_ADDRESS);
  }, true);

  closeLove.addEventListener("click", function(){
    loveOverlay.style.display="none";
  });
  loveOverlay.addEventListener("click", function(e){
    if(e.target && e.target.id==="loveOverlay") loveOverlay.style.display="none";
  });

  /* ======== Globos arriba (DESDE FIRESTORE) ======== */
  var adVariants = ["variant-gold","variant-blue","variant-pink"];

  var adsEnabledLocal = true;
  var adsIntervalMs = 20000;
  var adsMessagesLocal = [];
  var adsTimer = null;
  var adsIndex = 0;

  function showAdBubble(){
    if(!adsEnabledLocal) return;
    if(!adsMessagesLocal.length) return;

    var msg = adsMessagesLocal[adsIndex % adsMessagesLocal.length];
    adsIndex++;

    var variant = adVariants[Math.floor(Math.random()*adVariants.length)];
    var b = document.createElement("div");
    b.className = "adBubble " + variant;
    b.textContent = msg;

    var left = Math.floor(Math.random()*(Math.max(40, window.innerWidth-280))) + 20;
    var top  = Math.floor(Math.random()*60) + 20;

    b.style.left = left + "px";
    b.style.top  = top + "px";

    document.body.appendChild(b);

    setTimeout(()=>b.classList.add("adBubble-show"), 60);
    setTimeout(()=>b.classList.add("adBubble-hide"), 4600);
    setTimeout(()=>{ if(b.parentNode) b.parentNode.removeChild(b); }, 5600);
  }

  function restartAdsTimer(){
    if(adsTimer) clearInterval(adsTimer);
    setTimeout(showAdBubble, 2500);
    adsTimer = setInterval(showAdBubble, adsIntervalMs);
  }

  /* ======== TAP TAP - CORAZON RECIBIDO ======== */
var tapBaselineEstablished = false;
var tapListenerStartedAt = performance.now();
var tapHeartsCreated = 0;
var tapRecentIds = new Set();
var tapRecentIdOrder = [];
var pendingRemoteHearts = [];
var activeRemoteHearts = new Set();
var MAX_ACTIVE_REMOTE_HEARTS = 8;
var TAP_RECENT_ID_LIMIT = 512;
window.__rcxTapMetrics = {
  listenerStartedAt: tapListenerStartedAt,
  baselineAt: null,
  initialSnapshotSize: null,
  created: 0,
  queued: 0,
  maxActive: 0,
  firstButtonEventQueueMs: null,
  firstButtonFrameMs: null
};

// Diagnóstico de la primera interacción: no intercepta ni modifica el clic.
var firstTapUiClickRecorded = false;
document.addEventListener("click", function(event){
  if(firstTapUiClickRecorded) return;
  var target = event.target && event.target.closest
    ? event.target.closest("button, [role='button'], a, input")
    : null;
  if(!target) return;
  firstTapUiClickRecorded = true;
  var receivedAt = performance.now();
  var eventAge = receivedAt - Number(event.timeStamp || receivedAt);
  window.__rcxTapMetrics.firstButtonEventQueueMs =
    Number.isFinite(eventAge) && eventAge >= 0 && eventAge < 60000 ? eventAge : null;
  requestAnimationFrame(function(){
    var frameMs = performance.now() - receivedAt;
    window.__rcxTapMetrics.firstButtonFrameMs = frameMs;
    console.info("[RCX_UI] first_button=" + (target.id || target.tagName) +
      " event_queue_ms=" + window.__rcxTapMetrics.firstButtonEventQueueMs +
      " next_frame_ms=" + frameMs);
  });
}, true);

function rememberRemoteTapId(id){
  if(!id || tapRecentIds.has(id)) return false;
  tapRecentIds.add(id);
  tapRecentIdOrder.push(id);
  if(tapRecentIdOrder.length > TAP_RECENT_ID_LIMIT){
    tapRecentIds.delete(tapRecentIdOrder.shift());
  }
  return true;
}

function createRemoteHeartAt(x, y){
  var h = document.createElement("div");
  h.className = "heart";
  h.textContent = "❤";
  h.style.left = x + "px";
  h.style.top = y + "px";
  activeRemoteHearts.add(h);
  document.body.appendChild(h);
  tapHeartsCreated++;
  window.__rcxTapMetrics.created = tapHeartsCreated;
  window.__rcxTapMetrics.queued = pendingRemoteHearts.length;
  window.__rcxTapMetrics.maxActive = Math.max(
    window.__rcxTapMetrics.maxActive, activeRemoteHearts.size
  );

  window.setTimeout(function(){
    if(h.parentNode) h.parentNode.removeChild(h);
    activeRemoteHearts.delete(h);
    if(pendingRemoteHearts.length){
      var next = pendingRemoteHearts.shift();
      window.__rcxTapMetrics.queued = pendingRemoteHearts.length;
      createRemoteHeartAt(next.x, next.y);
    }
  }, 1700);
}

function spawnRemoteHeartAt(x, y){
  if(activeRemoteHearts.size < MAX_ACTIVE_REMOTE_HEARTS){
    createRemoteHeartAt(x, y);
  } else {
    pendingRemoteHearts.push({ x: x, y: y });
    window.__rcxTapMetrics.queued = pendingRemoteHearts.length;
  }
}
  /* ========= INICIO REAL (cuando ya está el login anónimo) ========= */
  function initFirestoreRealtime(){
    // ✅ presence doc listo
    presenceDoc = presenceRef.doc(sessionId);

    // ✅ presence realtime
    presenceRef.onSnapshot(function(snapshot) {
      renderPresence(snapshot.docs);
    });

    // ❤️ TAP TAP RECIBIDOS EN TIEMPO REAL
 tapTapsRef.onSnapshot({ includeMetadataChanges: true }, function(snapshot){
  var fromCache = !!(snapshot.metadata && snapshot.metadata.fromCache);
  if(fromCache){
    if(!tapBaselineEstablished){
      console.info("[RCX_TAP] cached_snapshot_docs=" + snapshot.size +
        " baseline=waiting_for_server elapsed_ms=" +
        (performance.now() - tapListenerStartedAt).toFixed(1));
    }
    return;
  }

  // El primer snapshot confirmado por el servidor es solo línea de base.
  // Sus documentos anteriores no se convierten en animaciones.
  if(!tapBaselineEstablished){
    tapBaselineEstablished = true;
    window.__rcxTapMetrics.baselineAt = performance.now();
    window.__rcxTapMetrics.initialSnapshotSize = snapshot.size;
    console.info("[RCX_TAP] server_baseline_docs=" + snapshot.size +
      " hearts_created=0 elapsed_ms=" +
      (window.__rcxTapMetrics.baselineAt - tapListenerStartedAt).toFixed(1));
    return;
  }

  var currentUser = firebase.auth().currentUser;
  var currentUid = currentUser && currentUser.uid;
  var changes = snapshot.docChanges();
  var accepted = 0;
  changes.forEach(function(change){
    if(change.type !== "added" || !tapBaselineEstablished) return;
    if(!rememberRemoteTapId(change.doc.id)) return;
    var data = change.doc.data() || {};
    // Solo animar Tap Tap nuevos de otros usuarios identificados.
    if(!currentUid || !data.senderId || data.senderId === currentUid) return;

    var x = window.innerWidth * (0.20 + Math.random() * 0.60);
    var y = window.innerHeight * (0.20 + Math.random() * 0.50);
    spawnRemoteHeartAt(x, y);
    accepted++;
  });
  if(changes.length){
    console.info("[RCX_TAP] live_changes=" + changes.length +
      " accepted_remote=" + accepted + " hearts_created=" + tapHeartsCreated +
      " active=" + activeRemoteHearts.size + " queued=" + pendingRemoteHearts.length);
  }
 }, function(error){
  console.error("[RCX_TAP] listener_error=" + (error && (error.code || error.message) || error));
 });

    // ✅ top fans realtime
    likesRef.orderBy("likes","desc").limit(10).onSnapshot(function(snapshot){
      var items=[];
      snapshot.forEach(function(doc){
        var d=doc.data();
        items.push({ usuario:String(d.usuario||doc.id), likes:Number(d.likes||0) });
      });
      renderTopFans(items);

    });

    // ✅ chat realtime
    messagesRef.orderBy("creado","desc").limit(40).onSnapshot(function(snapshot){
      var arr=[];
      snapshot.forEach(doc=>arr.push(doc.data()));
      arr.reverse();
      renderChat(arr);

    });

    // ✅ globos config realtime
    cfgRef.onSnapshot(function(snap){
      var data = snap.exists ? (snap.data()||{}) : {};

      adsEnabledLocal = (data.adsEnabled === true);
      var sec = Number(data.adsIntervalSec || 20);
      if(!sec || sec < 5) sec = 20;
      adsIntervalMs = sec * 1000;

      adsMessagesLocal = Array.isArray(data.adsMessages) ? data.adsMessages.slice() : [];

      if(!adsEnabledLocal){
        if(adsTimer) clearInterval(adsTimer);
        adsTimer = null;
        return;
      }
      restartAdsTimer();
    });

    // ✅ pings
    setTimeout(pingPresence, 800);
    setInterval(pingPresence, PRESENCE_PING_MS);

    // ✅ si ya había nickname guardado, manda join UNA VEZ
    try{
      var stored = localStorage.getItem("rcx_nickname");
      if(stored){
        sendJoinMessage(stored);
      }
    }catch(e){}
  }

  // ✅ Login anónimo primero, luego refs, luego init
  function initializeFirebaseClient(){
    if(firebaseBootstrapStarted) return;
    firebaseBootstrapStarted = true;
    try {
      if(!window.firebase || !firebase.auth || !firebase.firestore) throw new Error("SDK de Firebase incompleto");
      if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
    } catch(error) {
      console.warn("Radio Coravox: no se pudo inicializar Firebase.", error);
      resolveFirebaseReady({ available: false, error: error });
      return;
    }

    auth.onAuthStateChanged(async function(user){
    if(!user) return;

    db = firebase.firestore();
    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch(e) {
      console.info("Firestore persistence unavailable; continuing with live server data", e.code + ": " + e.message);
    }
    messagesRef = db.collection("mensajes-chat");
    flushPendingShareNotices();
    likesRef    = db.collection("likes-ranking");
    tapTapsRef = db.collection("tap-taps");
    presenceRef = db.collection("presence");
    cfgRef      = db.collection("config").doc("global");

    initFirestoreRealtime();
    });
    resolveFirebaseReady({ available: true });
    ensureAnonymousSignIn();
  }

  function loadFirebaseSdk(){
    var files=["firebase-app.js","firebase-auth.js","firebase-firestore.js"];
    var index=0;
    function loadNext(){
      if(index>=files.length){ initializeFirebaseClient(); return; }
      var name=files[index++];
      var ready=window.firebase &&
        (name!=="firebase-app.js" || typeof firebase.initializeApp==="function") &&
        (name!=="firebase-auth.js" || typeof firebase.auth==="function") &&
        (name!=="firebase-firestore.js" || typeof firebase.firestore==="function");
      if(ready){ loadNext(); return; }
      var script=document.createElement("script");
      script.async=true;
      script.src="https://www.gstatic.com/firebasejs/8.10.1/"+name;
      script.onload=loadNext;
      script.onerror=function(){
        var error=new Error("No se pudo cargar "+name);
        console.warn("Radio Coravox: Firebase no está disponible; los controles locales siguen activos.", error);
        resolveFirebaseReady({ available: false, error: error });
      };
      document.head.appendChild(script);
    }
    loadNext();
  }

  // Abrir el modal
document.getElementById("btnSpotify").onclick = () => {
    document.getElementById("modalSpotify").style.display = 'flex';
};

// Enviar el pedido a Firebase
document.getElementById("btnEnviarSpotify").onclick = () => {
    let cancion = document.getElementById("inputCancion").value.trim();
    if(cancion) {
        if(!db) {
            setStatus("Conectando con Firebase. Inténtalo de nuevo en un momento.");
            return;
        }
        // Usamos tu base de datos actual
        db.collection("pedidos_spotify").add({
            cancion: cancion,
            oyente: nickname, // Tu variable de nombre actual
            atendido: false,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert("¡Pedido enviado!");
            document.getElementById("modalSpotify").style.display = 'none';
            document.getElementById("inputCancion").value = "";
        });
    }
};

  window.__rcxUiReady = true;
  console.info("[RCX_INTERACTIVE] controles listos; inicio de Firebase no bloqueante");
  loadFirebaseSdk();




/* Saludos al aire: versión web del control que antes solo inyectaba Android MainActivity. */
(function() {
  if (window.__coravoxGreetingInstalled === true) return true;
  var playButton = document.getElementById('btnPlay');
  if (!playButton || !document.body) return false;
  var previousButton = document.getElementById('coravoxGreetingButton');
  if (previousButton) previousButton.remove();
  var previousOverlay = document.getElementById('coravoxGreetingOverlay');
  if (previousOverlay) previousOverlay.remove();

  var button = document.createElement('button');
  button.id = 'coravoxGreetingButton';
  button.type = 'button';
  button.textContent = '💌 ¡Manda tu saludo al aire!';
  button.style.cssText = 'display:block;width:min(92vw,360px);margin:10px auto 0;padding:12px 14px;border:1px solid #f5c85b;border-radius:14px;background:#17130a;color:#f5c85b;font-weight:800;font-size:15px;box-shadow:0 0 12px rgba(245,200,91,.25);';
  var greetingSlot = document.getElementById('greetingSlot');
  if (greetingSlot) greetingSlot.appendChild(button);
  else playButton.insertAdjacentElement('afterend', button);

  var overlay = document.createElement('div');
  overlay.id = 'coravoxGreetingOverlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.92);padding:20px;align-items:center;justify-content:center;';
  overlay.innerHTML = '<section style="width:100%;max-width:440px;max-height:90vh;overflow:auto;background:#111;border:2px solid #f5c85b;border-radius:18px;padding:22px;color:#fff;text-align:center;font-family:system-ui,sans-serif"><h2 style="color:#f5c85b;font-size:22px;margin:0 0 8px">💌 ¡Manda tu saludo al aire!</h2><p style="margin:0 0 14px;color:#ddd">Graba hasta 30 segundos. Escúchalo antes de enviarlo.</p><div id="coravoxGreetingStatus" role="status" style="min-height:24px;margin:8px 0;color:#f5c85b"></div><audio id="coravoxGreetingPreview" controls style="display:none;width:100%;margin:8px 0"></audio><div style="display:grid;gap:9px"><button id="coravoxGreetingRecord" type="button" style="padding:13px;border:0;border-radius:10px;background:#f5c85b;color:#000;font-weight:800">🎙️ Grabar saludo</button><button id="coravoxGreetingStop" type="button" style="display:none;padding:13px;border:0;border-radius:10px;background:#a83232;color:#fff;font-weight:800">⏹ Detener grabación</button><button id="coravoxGreetingAgain" type="button" style="display:none;padding:12px;border:1px solid #f5c85b;border-radius:10px;background:#222;color:#f5c85b">🔄 Volver a grabar</button><button id="coravoxGreetingSend" type="button" disabled style="display:none;padding:13px;border:0;border-radius:10px;background:#27874a;color:#fff;font-weight:800;opacity:.55">📨 Enviar saludo</button><button id="coravoxGreetingClose" type="button" style="padding:11px;border:1px solid #555;border-radius:10px;background:#222;color:#fff">Cerrar</button></div><p style="margin:12px 0 0;color:#999;font-size:12px">El audio se envía a Firebase y OpenAI para transcribirlo y filtrarlo; si se rechaza, se elimina.</p></section>';
  document.body.appendChild(overlay);

  var status = document.getElementById('coravoxGreetingStatus');
  var preview = document.getElementById('coravoxGreetingPreview');
  var recordButton = document.getElementById('coravoxGreetingRecord');
  var stopButton = document.getElementById('coravoxGreetingStop');
  var againButton = document.getElementById('coravoxGreetingAgain');
  var sendButton = document.getElementById('coravoxGreetingSend');
  var stream = null, context = null, source = null, processor = null, mute = null;
  var chunks = [], timer = null, startedAt = 0, recordedBlob = null, previewUrl = null;
  var MAX_SECONDS = 30, SAMPLE_RATE = 22050;

  function setStatus(text, error) { status.textContent = text; status.style.color = error ? '#ff8d8d' : '#f5c85b'; }
  function captureErrorMessage(error) {
    var name = error && error.name ? error.name : 'Error';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Android o WebView no autorizó el micrófono. Revisa el permiso de micrófono de Radio Coravox.';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No se detectó un micrófono disponible en el teléfono.';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'El micrófono está ocupado o Android no pudo iniciarlo. Cierra otras apps que lo estén usando e inténtalo de nuevo.';
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'El teléfono no admite los ajustes de audio solicitados.';
    if (name === 'SecurityError') return 'Android WebView bloqueó el acceso al micrófono por seguridad. Actualiza Android System WebView.';
    return 'No se pudo acceder al micrófono (' + name + ').';
  }
  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null; recordedBlob = null; preview.removeAttribute('src'); preview.style.display = 'none';
    againButton.style.display = 'none'; sendButton.style.display = 'none'; sendButton.disabled = true; sendButton.style.opacity = '.55';
  }
  function wavBlob(parts) {
    var limit = SAMPLE_RATE * MAX_SECONDS, total = Math.min(limit, parts.reduce(function(n, p) { return n + p.length; }, 0));
    var buffer = new ArrayBuffer(44 + total * 2), view = new DataView(buffer), offset = 0;
    function textAt(pos, value) { for (var i = 0; i < value.length; i++) view.setUint8(pos + i, value.charCodeAt(i)); }
    textAt(0, 'RIFF'); view.setUint32(4, 36 + total * 2, true); textAt(8, 'WAVE'); textAt(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); textAt(36, 'data'); view.setUint32(40, total * 2, true);
    for (var p = 0; p < parts.length && offset < total; p++) {
      var count = Math.min(parts[p].length, total - offset);
      for (var j = 0; j < count; j++) {
        var sample = Math.max(-1, Math.min(1, parts[p][j]));
        view.setInt16(44 + (offset + j) * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
      }
      offset += count;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }
  async function stopRecording() {
    if (!processor) return;
    clearTimeout(timer); timer = null;
    processor.onaudioprocess = null;
    try { processor.disconnect(); source.disconnect(); mute.disconnect(); } catch (_) {}
    if (stream) stream.getTracks().forEach(function(track) { track.stop(); });
    if (context && context.state !== 'closed') await context.close();
    processor = null; source = null; mute = null; stream = null; context = null;
    recordedBlob = wavBlob(chunks); chunks = [];
    previewUrl = URL.createObjectURL(recordedBlob); preview.src = previewUrl; preview.style.display = 'block';
    stopButton.style.display = 'none'; recordButton.style.display = 'none';
    againButton.style.display = 'block'; sendButton.style.display = 'block'; sendButton.disabled = false; sendButton.style.opacity = '1';
    setStatus('Grabación lista. Escúchala antes de enviarla.');
  }
  async function startRecording() {
    clearPreview(); chunks = [];
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioContext && !window.webkitAudioContext) {
      setStatus('Este dispositivo no permite grabar desde la app. Actualiza Android System WebView.', true); return;
    }
    try {
      // Pedir audio básico evita que un constraint opcional del WebView
      // se interprete erróneamente como un problema de permisos.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Radio Coravox: fallo getUserMedia', error);
      setStatus(captureErrorMessage(error), true);
      return;
    }
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      // Usar la frecuencia nativa del dispositivo; el WAV se genera
      // con context.sampleRate más abajo.
      context = new AudioContextClass();
      await context.resume();
      SAMPLE_RATE = context.sampleRate || SAMPLE_RATE;
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      mute = context.createGain(); mute.gain.value = 0;
      processor.onaudioprocess = function(event) {
        if (chunks.reduce(function(n, p) { return n + p.length; }, 0) < SAMPLE_RATE * MAX_SECONDS) chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      startedAt = Date.now();
      recordButton.style.display = 'none'; stopButton.style.display = 'block';
      setStatus('Grabando… ' + MAX_SECONDS + ' segundos como máximo.');
      timer = setTimeout(stopRecording, MAX_SECONDS * 1000);
    } catch (error) {
      console.error('Radio Coravox: micrófono abierto, fallo al iniciar el procesador de audio', error);
      if (stream) stream.getTracks().forEach(function(track) { track.stop(); });
      if (context && context.state !== 'closed') { try { await context.close(); } catch (_) {} }
      stream = null; context = null; source = null; processor = null; mute = null;
      recordButton.disabled = false; recordButton.style.display = 'block'; stopButton.style.display = 'none';
      var processorError = error && error.name ? error.name : 'Error';
      setStatus('Android abrió el micrófono, pero no pudo iniciar la grabación (' + processorError + ').', true);
    }
  }
  async function signedInUser() {
    if (firebase.auth().currentUser) return firebase.auth().currentUser;
    var result = await firebase.auth().signInAnonymously();
    return result.user;
  }
  async function loadStorage() {
    var firebaseReady = window.rcxFirebaseReady ? await window.rcxFirebaseReady : { available: false };
    if (!firebaseReady.available) throw new Error('Firebase todavía no está disponible. Revisa la conexión e inténtalo de nuevo.');
    return new Promise(function(resolve, reject) {
      if (firebase.storage) { resolve(); return; }
      var script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js';
      script.onload = resolve; script.onerror = function() { reject(new Error('No se pudo cargar Firebase Storage.')); };
      document.head.appendChild(script);
    });
  }
  async function sendGreeting() {
    if (!recordedBlob || !recordedBlob.size) { setStatus('Primero graba un saludo.', true); return; }
    sendButton.disabled = true; recordButton.disabled = true; againButton.disabled = true;
    setStatus('Enviando el saludo de forma segura…');
    try {
      await loadStorage();
      var user = await signedInUser();
      var storage = firebase.storage();
      var firstSlot = Math.floor(Math.random() * 3), uploaded = false;
      for (var attempt = 0; attempt < 3; attempt++) {
        var slot = (firstSlot + attempt) % 3;
        var ref = storage.ref().child('saludos/' + user.uid + '/slot-' + slot + '.wav');
        try {
          await ref.put(recordedBlob, { contentType: 'audio/wav', customMetadata: { ownerUid: user.uid, state: 'pending', createdAt: new Date().toISOString() } });
          uploaded = true; break;
        } catch (error) {
          if (error && error.code === 'storage/unauthorized') continue;
          throw error;
        }
      }
      if (!uploaded) throw new Error('FULL_OR_RULES');
      setStatus('¡Saludo enviado! Pasará por los filtros automáticos antes de salir al aire.');
      window.setTimeout(function() { overlay.style.display = 'none'; clearPreview(); }, 1800);
    } catch (error) {
      var message = error && error.message === 'FULL_OR_RULES'
        ? 'No se pudo enviar: puede que tengas 3 saludos pendientes o que falte configurar la seguridad de Firebase.'
        : 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.';
      setStatus(message, true); sendButton.disabled = false; recordButton.disabled = false; againButton.disabled = false;
    }
  }
  button.addEventListener('click', function() { overlay.style.display = 'flex'; setStatus('Listo para grabar.'); });
  recordButton.addEventListener('click', startRecording);
  stopButton.addEventListener('click', stopRecording);
  againButton.addEventListener('click', function() { clearPreview(); recordButton.style.display = 'block'; recordButton.disabled = false; againButton.disabled = false; setStatus('Graba un nuevo saludo cuando estés listo.'); });
  sendButton.addEventListener('click', sendGreeting);
  document.getElementById('coravoxGreetingClose').addEventListener('click', async function() { if (processor) await stopRecording(); clearPreview(); overlay.style.display = 'none'; });
  overlay.addEventListener('click', async function(event) { if (event.target === overlay) { if (processor) await stopRecording(); clearPreview(); overlay.style.display = 'none'; } });
  window.addEventListener('beforeunload', function() { if (stream) stream.getTracks().forEach(function(track) { track.stop(); }); if (previewUrl) URL.revokeObjectURL(previewUrl); });
  window.__coravoxGreetingInstalled = !!(
    document.getElementById('coravoxGreetingButton') &&
    document.getElementById('coravoxGreetingOverlay') &&
    document.getElementById('coravoxGreetingRecord') &&
    document.getElementById('coravoxGreetingSend') &&
    document.getElementById('coravoxGreetingClose')
  );
  return window.__coravoxGreetingInstalled;
})();


