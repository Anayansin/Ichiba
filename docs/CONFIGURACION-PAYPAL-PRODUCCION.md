# Configurar PayPal en producción y cobrar la comisión de Ichiba

Esta guía deja PayPal listo para **cobrar de verdad** y para que Ichiba retenga su comisión del **5 % + IVA (5.8 %)**. Está pensada para alguien que no programa: cada paso dice qué abrir, qué copiar y dónde pegarlo.

> **Importante:** hay dos cosas distintas que PayPal debe permitir:
>
> 1. **Cobrar a los compradores** (PayPal Checkout normal). Esto se configura con una app live.
> 2. **Repartir el dinero y retener la comisión de la plataforma** (`platform_fees`). Esto exige que la cuenta de Ichiba esté aprobada para **PayPal Complete Payments Platform (Marketplaces and Platforms)**. No siempre se activa solo: puede requerir verificación de negocio y aprobación de un ejecutivo de PayPal.
>
> Si la cuenta todavía no está aprobada para el punto 2, Ichiba puede seguir funcionando con `PAYPAL_COMISION_MODO=registro`: muestra la comisión, pero **no la cobra**. Ese modo **no** debe usarse para decir que la comisión ya está implementada en producción.

---

## 0. Datos de Ichiba que se usan en esta guía

| Dato | Valor actual |
| --- | --- |
| Frontend | `https://ichiba-three.vercel.app` |
| Backend | `https://backend-production-717f.up.railway.app` |
| Callback OAuth | `https://backend-production-717f.up.railway.app/api/pagos/paypal/vincular/callback` |
| Comisión | 5 % + IVA (16 %) = **5.8 %** |
| Moneda | **MXN** |

Si cambias de dominio, cambia también el callback en PayPal y en las variables de entorno. El callback debe coincidir **carácter por carácter**, sin barra final de más.

---

## 1. Preparar la cuenta de negocio de PayPal

1. Entra a [paypal.com](https://www.paypal.com) con la cuenta **de negocio** de Ichiba (no una cuenta personal).
2. Completa la verificación de negocio si PayPal la pide: datos fiscales, dirección, teléfono y cuenta bancaria.
3. **Opcional:** si PayPal te pide indicar la cuenta que recibe la comisión, busca el **Merchant ID** (también aparece como *PayPal Merchant ID* o *Payer ID*). Es un código de **13 caracteres**, por ejemplo `ABCDEFGHJKLMN`. Ese sería `PAYPAL_PLATFORM_MERCHANT_ID`.
   - Si no lo encuentras o no te lo piden, **déjalo vacío**. En ese caso PayPal acredita la comisión a la cuenta dueña de la app (la plataforma), que es el comportamiento normal.
   - Si lo configuras mal, PayPal puede rechazar la captura con `INVALID_PLATFORM_FEES_ACCOUNT`; en ese caso bórralo y vuelve a probar.
4. Si la cuenta es de México, confirma que puede **recibir pagos en MXN** y que no tiene límites de cuenta nuevos.

> **No confundas** el Merchant ID con el Client ID. El Client ID identifica a la app; el Merchant ID identifica a la cuenta que recibe el dinero.

---

## 2. Solicitar PayPal Complete Payments Platform

1. Entra al [portal de PayPal para plataformas](https://developer.paypal.com/platforms/) o contacta a tu ejecutivo/atención a negocios de PayPal.
2. Pide la habilitación de **Complete Payments Platform for Marketplaces and Platforms** (a veces aparece como **Multiseller**, **Partner Fee** o **Marketplace**).
3. Señala que Ichiba necesita:
   - Cobrar a un comprador y pagar a un vendedor distinto.
   - Retener una comisión de plataforma (`platform_fees`).
   - Reembolsar esa comisión cuando se reembolse la venta.
   - Enrolar a cada vendedor como vendedor de la plataforma (seller onboarding / `PARTNER_FEE`).
4. PayPal revisará la cuenta. Cuando la apruebe, confirma que la cuenta puede usar `platform_fees` al **capturar una autorización** (`intent: AUTHORIZE`) y dispersar el neto al vendedor.
5. Si no la aprueban, **no actives** `PAYPAL_COMISION_MODO=platform_fee` en producción: el checkout fallará. Usa `registro` solo mientras tanto y documenta que la comisión aún no se cobra.

> **Sobre el onboarding de vendedores:** que un vendedor autorice su cuenta con “Log in with PayPal” no siempre basta para que PayPal lo acepte como vendedor de la plataforma. Si PayPal rechaza `platform_fees` con `PERMISSION_DENIED` o `INVALID_PLATFORM_FEES_ACCOUNT`, pregunta a tu ejecutivo por el **seller onboarding** de Complete Payments y por la función **PARTNER_FEE**.

---

## 3. Crear la app live en PayPal Developer

1. Entra a [developer.paypal.com](https://developer.paypal.com/) y haz clic en **Log in** con la cuenta de negocio.
2. Ve a **Apps & Credentials**.
3. Cambia el selector de **Sandbox** a **Live**.
4. Haz clic en **Create App**.
5. Nombre: `Ichiba Produccion`.
6. Tipo de app: **Merchant** (o la opción que permita Checkout y Log in with PayPal).
7. Crea la app y copia:
   - **Client ID** → `PAYPAL_CLIENT_ID`
   - **Secret** → `PAYPAL_CLIENT_SECRET`
8. El secreto se muestra completo una sola vez. Si lo pierdes, genera uno nuevo y actualiza Railway.

### 3.1. Activar Log in with PayPal y el callback

Dentro de la app live:

1. Busca **Features** → **Log in with PayPal** (o **OAuth Login**) y actívalo.
2. En **Return URL** escribe exactamente:

   ```text
   https://backend-production-717f.up.railway.app/api/pagos/paypal/vincular/callback
   ```

3. Si la app pide **Privacy Policy URL** y **User Agreement URL**, usa las páginas públicas de Ichiba (o la URL de tus políticas). No dejes esos campos vacíos si PayPal los marca obligatorios.
4. En **Scopes**, habilita:
   - `openid`
   - `profile`
   - `email`
5. Guarda los cambios.

> El backend ya envía `scope=openid profile email` y el mismo `redirect_uri` al pedir el código y al canjearlo. Si la app no tiene ese callback registrado, PayPal responde `redirect_uri mismatch` o `invalid_grant`.

### 3.2. Confirmar que Checkout está habilitado

En la misma app live, revisa que **Accept payments** / **Checkout** esté activo. La app debe poder crear órdenes en `/v2/checkout/orders`.

---

## 4. Configurar las variables en Railway

Entra a [railway.com](https://railway.com) → proyecto **ichiba** → servicio **backend** → pestaña **Variables**. Agrega o corrige:

```env
PAYPAL_CLIENT_ID="<Client ID live>"
PAYPAL_CLIENT_SECRET="<Secret live>"
PAYPAL_API_BASE="https://api-m.paypal.com"
# Opcional: solo si PayPal te pide indicar la cuenta que recibe la comisión.
# Si se deja vacío, la comisión va a la cuenta dueña de la app.
PAYPAL_PLATFORM_MERCHANT_ID=""
PAYPAL_COMISION_MODO="platform_fee"
PAYPAL_REDIRECT_URI="https://backend-production-717f.up.railway.app/api/pagos/paypal/vincular/callback"
BACKEND_URL="https://backend-production-717f.up.railway.app"
FRONTEND_URL="https://ichiba-three.vercel.app"
```

Además, confirma que siguen presentes:

```env
DATABASE_URL="..."
MONGO_URI="..."
JWT_SECRET="<secreto largo y distinto al de desarrollo>"
PAYPAL_LLAVE_CIFRADO="<64 caracteres hexadecimales>"
GOOGLE_VISION_API_KEY="<la misma clave que ya funciona>"
MERCADOPAGO_ACCESS_TOKEN="..."
MERCADOPAGO_PUBLIC_KEY="..."
```

### 4.1. Generar `PAYPAL_LLAVE_CIFRADO`

Esta llave cifra el token de PayPal del vendedor. Debe tener **64 caracteres hexadecimales** (32 bytes). Genérala en tu computadora con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y pégalo en Railway. **No la cambies** después de que haya vendedores vinculados: si la cambias, los tokens guardados ya no se podrán descifrar y cada vendedor tendrá que volver a vincular su cuenta.

### 4.2. Reglas importantes

- **No pongas** `PAYPAL_API_BASE` en sandbox si las credenciales son live. PayPal responderá error de autenticación.
- **No pongas** `PAYPAL_COMISION_MODO=registro` en producción si ya tienes Complete Payments aprobado: estarías mostrando la comisión sin cobrarla.
- **No configures** `GOOGLE_VISION_ENDPOINT` ni `VISION_MODERACION=omitir` en producción.
- **No subas** `backend/.env` a Git.

Después de guardar las variables, Railway redepliega solo. Si no lo hace, usa **Deploy** → **Redeploy**.

---

## 5. Probar la vinculación de un vendedor

1. Entra a `https://ichiba-three.vercel.app` con una cuenta de vendedor.
2. Ve a **Panel del vendedor** y busca la tarjeta de PayPal.
3. Haz clic en **Vincular mi cuenta de PayPal**.
4. Debes llegar a la pantalla de PayPal. Inicia sesión con la cuenta **del vendedor** (no la de la plataforma) y autoriza.
5. PayPal debe regresar a:

   ```text
   https://ichiba-three.vercel.app/panel-vendedor?paypal=vinculado
   ```

6. En los logs de Railway debe aparecer algo como:

   ```text
   [paypal] Cuenta vinculada para el usuario 123 (Merchant ID ABCDEFGHJKLMN)
   ```

7. En el panel debe verse el correo de PayPal y el Merchant ID del vendedor.

### Si falla

| Mensaje / síntoma | Causa probable | Solución |
| --- | --- | --- |
| `redirect_uri mismatch` | El callback de la app no coincide con `PAYPAL_REDIRECT_URI`. | Copia la URL exacta, sin barra final, en ambos lugares. |
| `invalid_grant` | El código ya se usó, expiró o el `redirect_uri` del canje no coincide. | Repite la vinculación desde el inicio; revisa que el backend use la misma URL. |
| `invalid_client` | Client ID/Secret no son de la misma app o son de sandbox con base live. | Revisa las credenciales y `PAYPAL_API_BASE`. |
| `sin-identidad` | La app no tiene el scope `email` o el usuario no lo autorizó. | Activa `email` en la app y vuelve a vincular. |
| `state-invalido` | Tardaste más de 10 minutos o abriste el callback dos veces. | Vuelve a empezar desde el panel. |
| `PAYPAL_LLAVE_CIFRADO` faltante | No está configurada o no tiene 64 hex. | Genera una y agrégala en Railway. |

---

## 6. Probar un pago con comisión

Haz esta prueba con un producto barato y, de preferencia, con una cuenta compradora de prueba.

1. Un comprador entra a la fila de un producto de un vendedor que tenga PayPal vinculado.
2. Paga con PayPal. El comprador autoriza el cargo, pero el dinero queda **retenido** (escrow).
3. El comprador sube su comprobante; el vendedor lo confirma.
4. El comprador recibe su código de entrega y se lo da al vendedor.
5. El vendedor registra el código en **Ventas y entregas**.
6. En ese momento PayPal captura la autorización y cobra la comisión: la petición de captura lleva `payment_instruction.platform_fees`.

En el panel del vendedor debes ver, para esa venta:

```text
Comisión Ichiba (5 % + IVA = 5.8 %): $58.00 · Recibiste $942.00.
```

En una venta de $1,000 MXN:

| Concepto | Monto |
| --- | --- |
| Precio | $1,000.00 |
| Comisión 5 % | $50.00 |
| IVA 16 % de la comisión | $8.00 |
| **Comisión total 5.8 %** | **$58.00** |
| **Neto del vendedor** | **$942.00** |

En la actividad de PayPal:

- El comprador paga $1,000.00.
- El vendedor recibe $942.00.
- La cuenta de la plataforma recibe $58.00 como `platform_fee`.

> Las comisiones propias de PayPal (por recibir el pago) son adicionales y las absorbe quien corresponda según tu contrato con PayPal. La comisión de Ichiba es aparte.

### Si PayPal rechaza la orden

| Error de PayPal | Significado | Solución |
| --- | --- | --- |
| `PAYPAL_PLATFORM_MERCHANT_ID` con formato inválido (error de Ichiba) | El Merchant ID no tiene 13 caracteres válidos. | Corrígelo o deja la variable vacía. |
| `INVALID_PLATFORM_FEES_ACCOUNT` | La cuenta de la plataforma no está habilitada o el Merchant ID no es correcto. | Revisa el enrolamiento en Complete Payments; si configuraste el Merchant ID, bórralo y prueba sin él. |
| `PERMISSION_DENIED` / `NOT_AUTHORIZED` | La app no tiene permiso para `platform_fees`. | PayPal debe habilitar la capacidad de marketplaces. |
| `UNSUPPORTED_PAYMENT_INSTRUCTION` | La combinación de instrucciones no está permitida para esa cuenta. | Confirma con PayPal que `platform_fees` al capturar una autorización está habilitado y que el vendedor tiene `PARTNER_FEE`. |
| `INVALID_PLATFORM_FEES_AMOUNT` | La comisión supera el monto. | No debería ocurrir con 5.8 %; revisa el monto enviado. |

Mientras PayPal no esté habilitado, para no romper el checkout puedes usar **solo en desarrollo**:

```env
PAYPAL_COMISION_MODO="registro"
```

En ese modo la captura se hace sin `platform_fees`; el panel muestra la comisión y el neto, pero **el vendedor recibe el 100 %** y la plataforma no cobra. No lo uses para declarar la comisión como cobrada.

---

## 7. Probar un reembolso con comisión

1. Completa una venta como en el paso 6.
2. Abre una disputa o usa el flujo de cancelación con reembolso desde el BackOffice.
3. Al reembolsar, el backend envía también `payment_instruction.platform_fees` con la comisión.
4. Verifica en PayPal que el comprador recibe el monto completo y que la comisión de la plataforma se devuelve.

Si PayPal no acepta el reembolso con comisión, el backend reintenta **sin** `platform_fees` para no dejar al comprador sin reembolso. En ese caso revisa los logs: verás un aviso de que la comisión quedó pendiente de ajuste.

---

## 8. Cerrar la configuración

Marca esta lista cuando termines:

- [ ] Cuenta de negocio verificada.
- [ ] Complete Payments Platform aprobado (o decisión consciente de operar en `registro`).
- [ ] Vendedores enrolados como vendedores de la plataforma (seller onboarding / `PARTNER_FEE`).
- [ ] App live creada.
- [ ] `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` live en Railway.
- [ ] `PAYPAL_API_BASE=https://api-m.paypal.com`.
- [ ] `PAYPAL_PLATFORM_MERCHANT_ID` configurado solo si PayPal lo pide; si no, déjalo vacío.
- [ ] `PAYPAL_COMISION_MODO=platform_fee`.
- [ ] Callback registrado en la app y en `PAYPAL_REDIRECT_URI`.
- [ ] `PAYPAL_LLAVE_CIFRADO` de 64 hex configurada y respaldada.
- [ ] Vinculación de un vendedor real probada.
- [ ] Pago de $1,000 MXN probado con neto de $942 y comisión de $58.
- [ ] Reembolso con devolución de comisión probado.
- [ ] `JWT_SECRET` de producción rotado y cuentas demo suspendidas (P0 de seguridad).
- [ ] Volumen persistente de Railway para `/app/uploads` (para no perder imágenes en cada redeploy).

---

## 9. Referencias técnicas

- Crear orden: `POST https://api-m.paypal.com/v2/checkout/orders` con `intent: AUTHORIZE` y el `payee` del vendedor. **No** lleva `platform_fees`.
- Capturar autorización: `POST /v2/payments/authorizations/{authorization_id}/capture` con `payment_instruction.platform_fees`; ahí se cobra la comisión.
- Reembolso: `POST /v2/payments/captures/{capture_id}/refund` con `payment_instruction.platform_fees`.
- Identidad OAuth: `GET /v1/identity/oauth2/userinfo` (devuelve `payer_id` y correo).
- Token OAuth: `POST /v1/oauth2/token` con `grant_type=authorization_code` y el mismo `redirect_uri`.
- Documentación de PayPal: [Authorize and capture](https://developer.paypal.com/platforms/checkout/standard/customize/auth-capture), [Multi-seller payments](https://developer.paypal.com/platforms/checkout/standard/customize/multiseller-payments), [Delayed disbursement](https://developer.paypal.com/platforms/checkout/delayed-disbursement).
