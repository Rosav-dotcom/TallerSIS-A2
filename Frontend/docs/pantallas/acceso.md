# Login, Pantalla de bloqueo y Verificar factura

> Migración de la fase 0006. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Archivos** | `src/pages/Login.jsx`, `src/components/PantallaBloqueo.jsx` y `.css`, `src/pages/VerificarFactura.jsx`, `src/pages/acceso.css` |
| **Figma** | p.6 (Login) · p.11 ("Acceso por perfil y errores") · p.9 (Sesión bloqueada) · p.62–63 (Verificar factura) |
| **No se toca** | La validación y el envío del login, la limpieza forzada de usuario y contraseña (`emailRef`, `passwordRef`), la carga de cajas, el conteo de intentos del desbloqueo y el cierre de sesión al tercero, la consulta de la factura por el token del QR |

## Login (`/login`)

> Actualizado en la fase 0014 (login con foto, al estilo de la referencia aprobada).

- **Izquierda, panel navy (mitad de la pantalla):** logo RePay; "GESTIÓN FINANCIERA" con la línea dorada; título "Cobros y facturación del supermercado" en dos líneas; "Cada movimiento en orden. Cada jornada, con tranquilidad."; "Un espacio de trabajo para quienes gestionan el supermercado cada día."; la foto del supermercado con la esquina superior derecha bien redondeada; abajo, "RePay / Bolivia · Acceso seguro al ERP del supermercado". Una forma muy tenue decora la esquina inferior derecha.
- **La foto** está en `src/assets/login-supermercado.webp` (dentro del proyecto, sin depender de internet). Para cambiarla, se reemplaza ese archivo por otra imagen horizontal (proporción aproximada 1026 × 598) con el mismo nombre.
- **Derecha, sin tarjeta:** "Hola de nuevo." y "Ingresa con la cuenta que te asignó el supermercado.".
- **Perfil de acceso:** Cajero y Administrador en un selector de dos opciones. Los perfiles Encargado de Devoluciones y Usuario de Soporte se agregan en el Sprint 4 (TDSI-993).
- **Campos:** Correo electrónico, Contraseña con el botón de texto **Mostrar / Ocultar** y, solo para Cajero, **Caja** con la ayuda "La caja seleccionada se asignará a tu turno al ingresar.". Para Administrador: "Acceso a la administración y al análisis de la operación.".
- **Errores:** alerta roja con ícono, con los mismos mensajes de antes ("Complete el usuario, la contraseña y la caja.", "Error: Credenciales invalidas.", "Demasiados intentos fallidos. Inicie sesión nuevamente.").
- **Debajo del botón:** "¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva." y un recuadro de seguridad: para Cajero, que la pantalla se bloquea sola tras 5 minutos sin uso; para Administrador, "Usa un equipo de confianza y cierra sesión al terminar. No compartas tu contraseña.".
- **En celular:** el panel navy (con la foto más chica) queda arriba y el formulario abajo.

Los `<input>` del login se mantienen como elementos nativos con las clases `ui-campo` y `ui-control` (no `CampoTexto`), porque la limpieza forzada necesita sus referencias.

## Pantalla de bloqueo

- Velo navy translúcido con desenfoque: la pantalla de atrás no se puede leer.
- Tarjeta con el avatar, el correo y "Cajero · caja", el título "Pantalla bloqueada", el texto "El turno sigue abierto. Escriba su contraseña para volver.", la contraseña y el botón **Desbloquear**.
- Los errores ("Contraseña incorrecta. Le quedan 2 intentos.", "No se pudo conectar con el servidor. Intente de nuevo.") se muestran como alerta roja.

## Verificar factura (`/facturas/verificar/:token`, pública)

- Cabecera navy con el logo y el título "Verificar factura".
- Estado: alerta verde "Factura válida · Estado: …" o alerta roja **ANULADA**.
- Tarjeta "Comprobante de pago" con número, fecha, cliente (NIT/CI) y atendido por; tabla de métodos de pago; tarjeta con el **Total**.
- Sin factura: "Factura no encontrada" con su explicación. Mientras carga: líneas grises.
- Pensada para el celular del cliente: sin desplazamiento horizontal a 390 px.

## Pruebas después de este cambio

- [ ] Login de cajero con caja y login de administrador, cada uno a su pantalla de inicio.
- [ ] Credenciales incorrectas muestran el error del backend en la alerta roja.
- [ ] Al cambiar de perfil se borran los errores y el campo Caja aparece solo para Cajero.
- [ ] El ojo muestra y oculta la contraseña.
- [ ] Al volver al login, usuario y contraseña aparecen vacíos (no los rellena el navegador).
- [ ] Bloquear y desbloquear con la contraseña; con la contraseña incorrecta se ven los intentos restantes y al tercero se cierra la sesión.
- [ ] El QR de una factura abre Verificar factura en el celular; una anulada muestra ANULADA.
