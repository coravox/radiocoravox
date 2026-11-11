# Radio Coravox para iOS

Proyecto iOS independiente en Swift + WKWebView. La interfaz y el cliente web se toman de la rama `main` del repositorio `coravox/radiocoravox`; el fondo faltante en la raíz web se incorpora desde los recursos Android locales. La aplicación Android no se modifica.

## Funciones preparadas

- WKWebView carga recursos locales empaquetados y conserva las conexiones web a Firebase, streaming, chat, TapTap, Top Fans, pedidos y saludos.
- Swift usa AVPlayer para el stream y mantiene la reproducción en segundo plano con AVAudioSession.
- La pantalla bloqueada recibe título/artist de la API now-playing y los controles de reproducir/pausar se registran con MPRemoteCommandCenter.
- La app intenta reconectar el stream con espera exponencial cuando AVPlayer informa una interrupción o error.
- El diseño web existente usa viewport y safe areas; objetivo configurado para iPhone y iPad.

## Compilar en una Mac

1. Copia esta carpeta a una Mac compatible con Xcode 26 o posterior. Para subir a App Store Connect, Apple exige Xcode 26 o posterior y un SDK de iOS 26; el Xcode estable más reciente listado al preparar esta guía es Xcode 27.2. Revisa los [requisitos de sistema de Xcode](https://developer.apple.com/xcode/system-requirements/) antes de elegir la versión y macOS.
2. Abre `RadioCoravox/RadioCoravox.xcodeproj`.
3. Selecciona el target RadioCoravox y cambia el Bundle Identifier provisional `com.radiocoravox.ios` por uno propiedad de tu equipo.
4. Selecciona tu Team en Signing & Capabilities y deja activado Automatically manage signing.
5. Conecta un iPhone, selecciónalo como destino y pulsa Run. Para el simulador se puede usar cualquier iPhone simulator instalado.
6. En el dispositivo, concede el permiso de micrófono cuando pruebes los saludos. El audio de fondo está declarado en Info.plist con UIBackgroundModes = audio.
7. Prueba streaming, lock screen, llamadas/interrupciones, reconexión, metadata, chat, TapTap, ranking, pedidos, saludos, rotación y iPad antes de distribuir.

El proyecto tiene iOS 15 como mínimo y no requiere dependencias externas de Swift Package Manager. Los SDK web de Firebase los carga el propio cliente web existente. Todavía no incluye un catálogo de icono de app (`AppIcon`), que habrá que añadir antes de distribuir.

## Preparar TestFlight y App Store

- Registrar el Bundle ID y el equipo de firma en Apple Developer.
- Verificar privacidad, política de privacidad, derechos del streaming, descripciones y capturas en App Store Connect.
- Probar grabación y permisos en hardware real, incluyendo consentimiento de micrófono.
- Revisar con el equipo de Firebase si desean añadir un registro de app iOS al proyecto actual; este scaffold mantiene el cliente web y no cambia Firebase.
- En Xcode, Archive, distribuir a App Store Connect y completar la revisión de TestFlight/App Store.

## Limitaciones conocidas de esta primera estructura

Windows no incluye Xcode ni el SDK de iOS: desde este equipo se pueden editar y versionar los archivos, pero la compilación y pruebas en iPhone requieren Mac con Xcode o un runner Mac compatible. La grabación de voz desde WebKit cargado desde archivos locales debe confirmarse en dispositivo; si WebKit no autoriza `getUserMedia` para el origen local, habrá que mover ese flujo a grabación nativa en Swift con subida compatible con Firebase Storage. El proyecto aún necesita una compilación y prueba física antes de considerarlo funcional o listo para publicación.

