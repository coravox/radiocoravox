# Radio Coravox para iOS

Proyecto iOS independiente para la rama `ios/wkwebview-native-playback`. Swift y WKWebView reutilizan la interfaz web, los recursos y los servicios existentes. El proyecto Android y la configuración compartida de Firebase quedan fuera de esta carpeta.

## Requisitos y estado

- iOS no muestra opciones de colaboración económica: PayPal, Cash App, Zelle y Bitcoin están desactivados hasta confirmar que el receptor cumple los criterios de Apple para aceptar esos aportes dentro de esta app. Radio Coravox sigue gratuita, sin suscripciones, pagos ni funciones bloqueadas.

- Xcode 26 o posterior para generar binarios aceptados por App Store Connect. El proyecto tiene iOS 15 como versión mínima y destino universal para iPhone/iPad.
- No hay dependencias Swift Package Manager. El cliente web conserva el SDK Firebase 8.10.1 que carga desde Google CDN.
- En iOS, `AVAudioRecorder` graba los saludos como WAV PCM mono, 22.05 kHz y 16 bits. La web convierte los bytes en `audio/wav` y conserva la subida existente a Firebase Storage (`saludos/{uid}/slot-{0-2}.wav`) con autenticación anónima y metadatos actuales.
- La página conserva un grabador `getUserMedia` como alternativa para navegador; WKWebView iOS usa el grabador nativo para no depender de `file://`.
- El App Store URL está vacío deliberadamente en `Info.plist` (`CoravoxAppStoreURL`). El botón muestra “App Store: enlace pendiente” hasta que se publique la ficha. Android sigue usando el enlace oficial de Google Play en sus propios archivos.
- El icono universal de 1024×1024 está en `Assets.xcassets/AppIcon.appiconset` y se construye desde el logotipo oficial sobre fondo opaco.

## Abrir y ejecutar en una Mac

1. Descarga el repositorio y cambia a `ios/wkwebview-native-playback`.
2. Abre `RadioCoravox/RadioCoravox.xcodeproj`.
3. Selecciona el esquema compartido `RadioCoravox` y el destino de iPhone o iPad.
4. Para instalar en un dispositivo conectado, inicia sesión en Xcode con tu Apple Account, asigna un Team en **Signing & Capabilities**, y cambia el Bundle Identifier provisional `com.radiocoravox.ios` por un identificador que controles.
5. Conecta y confía en el iPhone; activa **Developer Mode** cuando iOS lo solicite y pulsa **Run**.
6. Prueba el micrófono aceptando el permiso del sistema. Comprueba grabación, reproducción previa, subida, audio en segundo plano, pantalla bloqueada, llamadas/interrupciones, reconexión y orientación.

Una cuenta Apple gratuita permite ejecutar una compilación de desarrollo en tus propios dispositivos. TestFlight y App Store requieren una membresía Apple Developer Program activa.

## Compilación remota gratuita con GitHub Actions

El repositorio usa runners macOS estándar de GitHub Actions. Como el repositorio es público, los builds estándar de macOS son gratuitos. No hace falta añadir una tarjeta, contratar Codemagic ni guardar claves para la compilación del simulador.

1. En GitHub abre **Settings → Actions → General** y confirma que Actions esté habilitado.
2. Sube los cambios únicamente a `ios/wkwebview-native-playback`.
3. El workflow `.github/workflows/ios-build.yml` compila automáticamente cada push a esa rama. Para repetir el build sin editar archivos, desde Windows puedes crear un commit vacío: `git commit --allow-empty -m "Rebuild iOS simulator"` y luego `git push origin ios/wkwebview-native-playback`.
4. El build compila para simulador sin firma y publica el `.app` como artefacto durante 7 días. Este artefacto sirve para confirmar compilación y no se puede instalar directamente en un iPhone.

El workflow `.github/workflows/ios-testflight.yml` sólo firma cuando el mensaje de un commit en la rama iOS incluye `[ios-ipa]` o `[testflight]`. GitHub sólo permite `workflow_dispatch` cuando el workflow está en la rama predeterminada; como este trabajo no debe entrar en `main`, uso el mensaje de commit para mantener el control en la rama iOS. Los secretos sólo se consultan al crear un IPA y no se imprimen.

## Firma segura y generación del IPA para TestFlight

Antes de usar el workflow de distribución necesitas:

1. Membresía Apple Developer Program, App ID y ficha creada en App Store Connect con el mismo Bundle Identifier.
2. Certificado **Apple Distribution** exportado como `.p12` con contraseña y perfil de aprovisionamiento **App Store Connect** coincidente.
3. En **GitHub → Settings → Environments**, crea el entorno `ios-distribution` y limita sus despliegues a la rama `ios/wkwebview-native-playback`.
4. Añade al entorno las siguientes variables y secretos. Nunca subas certificados, perfiles, archivos `.p8`, contraseñas o claves al repositorio.

Variables del entorno:

- `IOS_TEAM_ID`: Team ID de Apple.
- `IOS_BUNDLE_ID`: identificador de paquete registrado.

Secrets del entorno:

- `IOS_CERTIFICATE_P12_BASE64`: contenido del certificado `.p12` codificado en Base64.
- `IOS_CERTIFICATE_PASSWORD`: contraseña del `.p12`.
- `IOS_PROVISIONING_PROFILE_BASE64`: perfil `.mobileprovision` codificado en Base64.
- `IOS_KEYCHAIN_PASSWORD`: contraseña aleatoria para el llavero temporal del runner.
- Para enviar el IPA automáticamente a TestFlight: `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` y `APP_STORE_CONNECT_API_KEY_P8_BASE64` (clave API `.p8` codificada en Base64, con permisos mínimos necesarios).

La codificación Base64 no cifra los archivos; guárdalos sólo como GitHub Environment Secrets. No los pegues en el YAML ni en archivos de configuración. El workflow crea un llavero temporal en el runner, instala la identidad de firma y el perfil, archiva la app, exporta el IPA y destruye el runner al finalizar.

Para generar un IPA sin subirlo, haz un commit en la rama iOS cuyo mensaje incluya `[ios-ipa]`; el IPA firmado quedará como artefacto de GitHub. Para subir también a TestFlight, usa `[testflight]` en el mensaje; el workflow requiere además los secretos de la clave API de App Store Connect. No uses esos marcadores hasta que el entorno esté configurado.

## Instalar y probar en iPhone

La vía recomendada sin una Mac propia es TestFlight:

1. Ejecuta el workflow firmado con `upload_to_testflight` activado.
2. Espera a que Apple procese el build en App Store Connect y habilita el grupo de testers.
3. Instala TestFlight desde App Store en el iPhone, acepta la invitación y pulsa **Instalar** en la versión de Radio Coravox.
4. Prueba audio con pantalla bloqueada, controles de reproducción, interrupciones, reconexión, metadata, chat, TapTap, Top Fans, Club de Fans, pedidos y saludos con micrófono.

Un IPA exportado para App Store Connect no se instala tocándolo en el iPhone: se instala a través de TestFlight. La instalación directa fuera de TestFlight requiere un perfil de desarrollo/Ad Hoc, dispositivo registrado y firma compatible; no está configurada en este workflow.

## Enlaces de tienda

La página web determina el destino según la plataforma. iOS lee `CoravoxAppStoreURL` de `Info.plist`, actualmente vacío, y deshabilita la copia del enlace hasta que la ficha exista. Tras publicar la app, coloca en esa clave la URL real de App Store; no hace falta cambiar el enlace Google Play de Android.

## Seguridad y Firebase

- El workflow básico sólo recibe permiso `contents: read` y no accede a secretos.
- El workflow firmado se activa manualmente y sólo en la rama iOS. Los secretos se alojan en el entorno `ios-distribution`.
- El código web incluye la configuración cliente Firebase existente. La API key cliente no es una contraseña de servidor; las reglas Firestore/Storage son las que deben limitar operaciones. Este proyecto no contiene credenciales de cuenta de servicio, claves privadas Firebase ni cambios a reglas/configuración compartida.
- No guardes certificados Apple ni claves de App Store Connect en Git, issues, logs o artefactos. Rota cualquier secreto que se haya expuesto accidentalmente.

## Limitaciones conocidas

Windows puede editar y subir el código; no puede ejecutar Xcode ni probar el micrófono o el audio de fondo. El simulador remoto comprueba compilación, pero la grabación de voz, la reproducción bloqueada, el comportamiento real de Firebase y TestFlight requieren una prueba en iPhone físico. La URL de App Store, el Bundle Identifier final, la firma Apple y sus secretos aún deben configurarse por el propietario de la cuenta.
