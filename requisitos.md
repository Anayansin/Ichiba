Módulo 1: Registro y autentificación

Requerimientos Funcionales

Requerimientos no funcionales

RQF1: El usuario vendedor ingresa su nombre completo, domicilio, teléfono, correo electrónico, RFC, 2 imágenes de su identificación oficial y una contraseña para registrarse en la plataforma.

RQNF1.1: El sistema debe validar que todos los campos del formulario de registro de vendedores estén completos antes de permitir el envío de los datos.

RQNF1.2: El sistema debe validar que el campo de “teléfono” cuente con 10 dígitos.

RQNF1.3: El sistema debe enviar un código de confirmación numérico de 4 dígitos, generado de manera aleatoria vía correo electrónico.

RQNF1.4: El sistema debe validar que el RFC coincida con los primeros 10 caracteres de la CURP extraídos de la imagen proporcionada de la INE.

RQNF1.5: El sistema debe validar que el campo de nombre completo coincida con la información de la INE.

RQNF1.6: El sistema debe permitir únicamente los formatos .png .jpeg y .jpg con un tamaño mínimo de 420 × 540 píxeles para las 2 imágenes de la identificación oficial.

RQNF1.7: El sistema debe verificar que la contraseña de registro del vendedor cuente con una longitud mínima de 10 caracteres e incluya al menos una letra mayúscula, una letra minúscula, un número y un símbolo especial los cuales son los siguientes: !, @, #, $, %, &, \*, -, \_.

RQNF1.8: El sistema debe extraer los datos de Nombre completo y CURP (los primeros 10 caracteres deben coincidir con el RFC) de las imágenes con structor.

RQNF1.9: El sistema valida, al momento del registro de un nuevo usuario vendedor, que el RFC y los datos de la identificación oficial (INE) ingresados no coincidan con ningún registro de la lista negra generada por cancelaciones previas de cuenta; de existir coincidencia, debe denegar el registro.

RQF1.1: El usuario vendedor visualiza un mensaje de error indicando que su registro fue denegado, cuando su RFC o identificación oficial coincidan con un registro en la lista negra.

RQNF1.1: El sistema debe mostrar el mensaje de error de registro denegado de forma inmediata al intentar enviar el formulario, sin revelar al usuario los datos específicos que generaron la coincidencia con la lista negra, limitándose a indicar que el registro no pudo completarse.

RQF2: El usuario vendedor selecciona una casilla de verificación durante el registro para aceptar recibir notificaciones por correo electrónico sobre su estado de usuario, la fila virtual y los pagos realizados.

RQNF2.1: El sistema no debe permitir el registro de usuarios si no acepta recibir estas notificaciones.

RQNF2.2: El sistema debe permitir al usuario continuar con su registro si acepta recibir estas notificaciones.

RQNF2.3: El sistema debe guardar la selección de la casilla de notificaciones.

RQF3: El usuario vendedor selecciona una casilla de verificación durante el registro para aceptar recibir notificaciones por correo electrónico sobre los comentarios en publicaciones publicitarias.

RQNF3: El sistema debe guardar la selección de la casilla de notificaciones.

RQF4: El sistema redirige al usuario vendedor a la pasarela oficial de PayPal mediante un nodo seguro empleando el protocolo OAuth 2.0 para vincular su cuenta.

RQNF4: El sistema almacena el Token de Acceso cifrado (Merchant ID) otorgado por PayPal para gestionar los fondos bajo un sistema de escrow.

RQF5: El usuario vendedor define su disponibilidad de asistencia personalizada seleccionando días y rangos de horarios específicos de entre las 05:00 horas hasta las 23:59 horas, hora de zona centro (GMT-6).

RQNF5.1: El sistema debe guardar los horarios de disponibilidad del usuario vendedor en formato de 24 horas.

RQNF5.2: El sistema debe solicitar, un horario de atención mínimo de 1 hora a la semana.

RQNF5.3: El sistema debe solicitar al usuario vendedor una confirmación obligatoria del horario establecido cada 1ro de mes

RQNF5.4: El sistema guarda la confirmación o en su defecto el conteo de no confirmaciones.

RQF6: El usuario vendedor puede actualizar, confirmar o modificar sus horarios de atención establecidos.

RQNF6.1: El sistema debe hacer las actualizaciones correspondientes si existe un cambio.

RQNF6.2: El sistema debe solicitar, un horario de atención mínimo de 1 hora a la semana.

RQNF6.3: El sistema envía un aviso 15 días antes de la eliminación de su cuenta.

RQNF6.4: El sistema cuenta 2 ocasiones de falta de confirmación para enviar el aviso de eliminación de cuenta.

RQNF6.5: El sistema elimina la cuenta el 1ro de mes que tenga 2 faltas de confirmación seguidas.

RQNF6.6: El sistema elimina todos los registros relacionados con el usuario sin posibilidad de recuperarlos.

RQF6: El usuario vendedor no confirma su horario de atención.

RQNF6: El sistema debe restringir el acceso a las funciones de publicación y edición de catálogo del usuario vendedor hasta que confirme su horario de atención.

RQF6: El usuario vendedor ingresa su correo electrónico y su contraseña para iniciar sesión en la plataforma.

RQNF6: El sistema debe autenticar las credenciales de inicio de sesión consultando registros en la base de datos de MongoDB, dichos datos estarán cifrados por bcryptjs.

Módulo 2: administración de catálogo (Vendedor)

Requerimientos funcionales

Requerimientos no funcionales

RQF7: El usuario vendedor publica un producto ingresando el nombre del producto, precio, descripción detallada, condiciones de uso o estado del artículo (nuevo, usado-como nuevo, usado-buen estado o usado aceptable), fotografía, el método de entrega seleccionado de una lista predefinida (envío a domicilio, punto de encuentro o entrega en tienda) y un rango horario propuesto para coordinar la entrega con el comprador, además de un tiempo límite de pago para los compradores.

RQNF7.1: El sistema debe validar que todos los campos del registro del producto estén completos.

RQNF7.2: El sistema debe permitir únicamente los formatos .png .jpeg y .jpg con un tamaño mínimo de 420 × 540 y máximo de 2560 x 2560 píxeles para la fotografía del producto.

RQNF7.3: El sistema debe validar que el precio tenga un mínimo de $10 pesos mexicanos y un máximo de $5,000 pesos mexicanos.

RQNF7.4: El sistema debe validar que la descripción de uso tenga como mínimo 30 caracteres y máximo 100 (contando espacios).

RQNF7.5: El sistema debe validar que exista una selección en la categoría de estado del producto.

RQNF7.3: El sistema debe emplear la API especializada en moderación de contenido Cloud vision API para analizar las fotografías de productos y prevenir la publicación de objetos excluidos como carros, motos, casas, terrenos, mascotas, personas, armas, sustancias controladas o productos perecederos.

RQNF7.3: El sistema debe emplear una función de detección de contenido inapropiado que compare el texto ingresado contra una lista de palabras no permitidas, aplicándose a todos los campos de texto ingresados por el usuario. Al coincidir el sistema bloquea el envio.

RQNF7.4: El sistema debe restringir el tiempo límite de pago asignado por el vendedor al comprador con un mínimo asignable de 30 minutos y un máximo de 3 horas. valor por defecto de 1 hora,

RQNF7.5: El sistema debe guardar la información todos los campos.

RQNF8: El usuario vendedor recibe una alerta del sistema cuando el contenido ingresado en un campo de texto de su publicación coincide con alguna palabra no permitida, impidiéndose el envío o guardado de dicho contenido.

RQNF8.1: El sistema debe mostrar la alerta de contenido no permitido después de detectar la coincidencia.

RQNF8.2: El sistema debe permitir al usuario vendedor corregir el contenido señalado y volver a intentar el envío, sometiéndolo nuevamente a la validación establecida en el RQNF7.7.

RQF8: El usuario vendedor selecciona obligatoriamente una de las siguientes categorías predefinidas al publicar una venta: Artesanías, Ropa (segunda mano), Hogar, Electrodomésticos, Coleccionables u Otros.

RQNF8.1: El sistema debe validar que existe la selección de una categoría.

RQNF8.2: El sistema debe guardar la selección del usuario vendedor.

RQF9: El usuario vendedor promociona un artículo ingresando el nombre del producto, descripción, condiciones de uso o estado del artículo, fotografías, precio, la opción de habilitar o deshabilitar el chat o zona de comentarios, y la cobertura de envío/zona en la que se encuentra.

RQNF9.1: El sistema debe validar que los campos no estén vacíos.

RQNF9.2: El sistema debe permitir únicamente los formatos .png .jpeg y .jpg con un tamaño mínimo de 420 × 540 y máximo de 2560 x 2560 píxeles para la fotografía del producto.

RQNF9.3: El sistema debe emplear la API especializada en moderación de contenido Cloud vision API para analizar las fotografías de productos y prevenir la publicación de objetos excluidos como carros, motos, casas, terrenos, mascotas, personas, armas, sustancias controladas o productos perecederos.

RQNF9.4: El sistema debe emplear una función de detección de contenido inapropiado que compare el texto ingresado contra una lista de palabras no permitidas, aplicándose a todos los campos de texto ingresados por el usuario. Al coincidir el sistema bloquea el envio.

RQNF9.5: El sistema debe validar que el precio tenga un mínimo de $5,001 pesos mexicanos, sin máximo de precio.

RQNF10: El usuario vendedor recibe una alerta del sistema cuando el contenido ingresado en un campo de texto de su publicación coincide con alguna palabra no permitida, impidiéndose el envío o guardado de dicho contenido.

RQNF10.1: El sistema debe mostrar la alerta de contenido no permitido inmediatamente después de detectar la coincidencia.

RQNF10.2: El sistema debe permitir al usuario vendedor corregir el contenido señalado y volver a intentar el envío, sometiéndolo nuevamente a la validación establecida en el RQNF7.7.

RQF10: El usuario vendedor realiza reportes eligiendo el motivo: comportamientos errados o impropios, estafas, fotos inapropiadas, comprobantes de pago falsos, palabras malsonantes o discriminación y agregando una descripción.

RQNF10.1: El sistema debe calcular la reputación del vendedor mediante un sistema de puntos por infracción, asignando 3 puntos a las faltas graves (suplantación de identidad, acoso o amenazas, discriminación o discurso de odio, producto engañoso o diferente a la descripción, comprobante de pago falso, estafa o dinero no entregado), 1.5 puntos a las faltas leves de trato directo hacia otro usuario (faltas de respeto o insultos, lenguaje grosero o inapropiado), y 1 punto a las faltas leves (actitud hostil o arrogante, spam o publicidad no deseada, y otro motivo).

RQNF10.3: El sistema debe sumar de forma acumulativa los puntos obtenidos por el vendedor y eliminar su cuenta de forma permanente y sin posibilidad de recuperación al alcanzar 8 puntos acumulados.

RQNF10.4: El sistema guarda los reportes cuyo motivo sea "otro motivo".

RQF11: El sistema notifica al usuario vendedor, mediante correo electrónico, que su cuenta ha sido cancelada de forma permanente al alcanzar los 8 puntos de reputación acumulados.

RQNF10.5: El sistema debe enviar la notificación de cancelación de cuenta cuando la suma de la reputación sea igual a 8, indicando el motivo de la cancelación y los reportes que la originaron.

RQNF10.6: El sistema debe eliminar de forma permanente e irrecuperable, al cancelar la cuenta de un vendedor, toda su información personal y de la plataforma: nombre completo, domicilio, teléfono, correo electrónico, contraseña, publicaciones, historial de chats y token de acceso de PayPal, conservando únicamente el RFC y los datos de la identificación oficial (INE) en una lista negra.

RQNF10.7: El sistema debe cancelar automáticamente todas las filas virtuales activas de un vendedor con cuenta cancelada en las que el cliente aún no haya realizado el pago, retirándolo de la fila y notificándole que el producto ya no está disponible.

RQF12: El usuario vendedor con cuenta cancelada accede únicamente a las transacciones con pago ya confirmado, pudiendo completar la entrega sin acceso a ninguna otra función de la plataforma.

RQNF10.1: El sistema debe permitir al vendedor con cuenta cancelada completar únicamente las entregas cuyo pago ya haya sido confirmado antes de la cancelación (publicación, edición de catálogo, recepción de nuevos clientes en fila).

RQNF10.2: El sistema debe cancelar automáticamente la transacción y reembolsar al comprador, mediante la API de PayPal, el monto retenido en escrow, si el vendedor con cuenta cancelada no registra el código de confirmación de entrega dentro del plazo establecido en RQF24.

RQF10: El usuario cliente visualiza, cuando es retirado de una fila virtual por cancelación de la cuenta del vendedor.

RQNF10.1: El sistema debe mostrar el aviso de producto no disponible al retirar al cliente de la fila, eliminando dicha fila de su lista de filas activas.

RQF11: El usuario vendedor modifica la información de una publicación (nombre del producto, categoría, precio, descripción detallada, condiciones de uso o estado del artículo, fotografía, método de entrega y rango horario propuesto de entrega) del catálogo.

RQNF11.1: El sistema impide la edición o eliminación de una publicación si existe una transacción activa o fila en curso vinculada a dicho producto.

RQNF11.4: El sistema valida nuevamente cada campo editado de la publicación, aplicando las mismas reglas de validación establecidas para su publicación inicial en el requerimiento RQF7.1- RQF7.6.

RQNF11.1: El usuario vendedor visualiza un aviso indicando que no puede editar ni dar de baja la publicación mientras exista una transacción activa o una fila en curso vinculada a ella.

RQNF11.1: El sistema impide la edición de una publicación si existe una transacción activa o una fila en curso vinculada a dicho producto.

RQNF11.2: El sistema impide dar de baja una publicación del catálogo si existe una transacción activa o una fila en curso vinculada a dicho producto.

RQNF11.5: El sistema cambia el estado de la publicación a inactiva y la retira del catálogo visible para los clientes cuando el vendedor la da de baja, conservando su registro para el historial de ventas y los informes.

RQF12: El usuario vendedor consulta el estado activo o inactivo de sus productos, cuáles tienen una fila en curso y cuáles han sido vendidos desde un panel de control, además del indicador de reputación calculado a partir de las calificaciones de 1 a 5 estrellas (números enteros) otorgadas por los usuarios compradores.

RQNF12: El sistema debe calcular el indicador de reputación del vendedor como el promedio de las calificaciones de 1 a 5 estrellas (números enteros) otorgadas por los usuarios compradores.

RQF13: El usuario vendedor descarga en formato PDF sus informes de ventas que incluyen el total de ventas por período, productos vendidos, tiempo promedio por fila, tasa de concertación.

RQNF13.1: El sistema debe generar los informes de ventas en períodos mensuales cada 1ro del mes, calculando cada indicador total de ventas, productos vendidos, tiempo promedio por fila (todos sus productos), tasa de concertación, con base en las transacciones concluidas dentro de ese mes.

RQNF13.2: El sistema calcula la tasa de concertación del vendedor dividiendo el número de ventas concluidas entre el número total de filas virtuales iniciadas en sus productos dentro del período correspondiente, expresando el resultado como porcentaje.

RQNF13.2: El sistema debe generar y agregar al historial el informe de ventas correspondiente al mes recién concluido cada día 1° de mes.

RQNF13.3: El sistema debe permitir al vendedor consultar y descargar en PDF, en cualquier momento, el historial completo de informes mensuales generados previamente.

RQNF14.1: El sistema mantiene un contador de antigüedad individual por cada reporte registrado, calculado a partir de su propia fecha de creación, y elimina de forma permanente únicamente ese reporte el día 1° del mes en que cumpla 13 meses de antigüedad.

Módulo 3: Fila virtual y proceso de compra (Cliente y Vendedor)

Requerimientos funcionales

Requerimientos no funcionales

RQF15: El usuario cliente visualiza en cada elemento su imagen principal, su precio y el nombre del artículo.

RQNF15.1: El sistema debe mostrar únicamente publicaciones activas en el catálogo.

RQNF15.3: El sistema emplea la Intersection Observer API del navegador para detectar cuándo el usuario llega al final del listado y solicita al servidor, mediante paginación sobre MongoDB, los siguientes 12 elementos; el listado se carga inicialmente con 12 elementos y se amplía de 12 en 12 cada vez que el usuario llega al final.

RQF15.1: El usuario cliente utiliza la barra de navegación para acceder a las secciones Inicio, Chats, Categorías, Promocionales, Nosotros, Ayuda e Iniciar sesión.

RQNF15.5: El sistema redirige al usuario a la sección correspondiente al seleccionar una opción de la barra de navegación.

RQF16: El usuario cliente presiona el botón "Entrar en la fila" para registrar su lugar en un producto disponible.

RQNF16.1: El sistema debe gestionar el orden de atención de los usuarios en la fila virtual estructurando una cola bajo el método estricto de FIFO (First In, First Out).

RQNF16.2: El sistema debe limitar el acceso simultáneo a un máximo de tres filas virtuales por usuario cliente.

RQNF16.3: El sistema debe permitir que cualquier usuario cliente ingrese a la fila virtual de un producto disponible (activo y dentro del bloque de atención vigente del vendedor), sin limitar el número de usuarios formados por producto, respetando únicamente el límite de tres filas simultáneas por cliente.

RQF16.1: El usuario cliente visualiza el mensaje informativo “Ya estás en 3 filas. Abandona una para continuar” cuando intenta ingresar a una cuarta fila simultánea.

RQNF16.3: El sistema debe contar las filas virtuales activas del usuario cliente al presionar el botón “Entrar en la fila”, antes de registrar su lugar.

RQNF16.4: El sistema debe impedir el registro del usuario cliente en una cuarta fila simultánea, manteniendo sin cambios sus tres filas actuales.

RQF16.2: El usuario cliente visualiza, al colocar el cursor sobre un producto del panel principal, un indicador que señala si el artículo está disponible o inactivo por horario y, cuando está inactivo por horario, el horario de atención del vendedor.

RQNF16.6: El sistema muestra en el panel principal los productos cuyo vendedor se encuentra fuera de su bloque de horario de atención, identificándolos como inactivos.

RQNF16.7: El sistema despliega, al detectar el cursor sobre un producto, el indicador de disponibilidad (disponible o inactivo).

RQNF16.8: El sistema debe obtener la fecha y hora de inicio del siguiente bloque de atención a partir de los horarios de disponibilidad guardados por el vendedor, tomando el bloque inmediato posterior al vigente.

RQF16.3: El usuario cliente visualiza deshabilitada la opción “Entrar en la fila” en los productos inactivos por horario junto con la fecha y hora de inicio del siguiente bloque de atención del vendedor.

RQNF16.1: El sistema deshabilita la opción "Entrar en la fila" en los productos inactivos.

RQNF16.3: El sistema debe permitir que cualquier usuario cliente ingrese a la fila virtual de un producto disponible (activo y dentro del bloque de atención vigente del vendedor), sin limitar el número de usuarios formados por producto.

RQF18: El usuario cliente que llega al primer
lugar de la fila visualiza dos opciones, “Pagar
ahora” o “Esperar al siguiente bloque”,
cuando el tiempo restante del bloque de atención vigente es menor al tiempo límite de pago del producto.

RQNF18.1: El sistema debe considerar que
el bloque está “próximo a finalizar” cuando el tiempo restante del bloque vigente sea menor al tiempo límite de pago asignado por el vendedor al producto.

RQNF18.2: El sistema debe mantener al cliente en el primer lugar de la fila, sin ceder su turno al siguiente usuario, mientras el cliente elige una opción.

QNF18.3: El sistema debe guardar la opción elegida por el cliente.

RQF18.1: El usuario cliente visualiza, antes de elegir, una advertencia que indica: si elige “Pagar ahora”, dispondrá de todo el tiempo límite de pago, pero no podrá comunicarse con el vendedor ni recibir atención hasta el siguiente bloque (se muestra su fecha y hora); si elige “Esperar al siguiente bloque”, conserva el primer lugar y su tiempo límite de pago inicia al comenzar dicho bloque.

RQNF18.4: El sistema debe otorgar el tiempo límite de pago completo y mantener bloqueado el chat hasta el siguiente bloque de atención cuando el cliente elija “Pagar ahora”.

RQNF18.5: El sistema debe iniciar el conteo del tiempo límite de pago hasta que comience el siguiente bloque de atención cuando el cliente elija “Esperar al siguiente bloque”.

RQNF18.6: El sistema debe liberar el tiempo reservado y asignar el turno al siguiente usuario en espera si el cliente abandona la fila.

RQF17: El usuario cliente hace clic en el nombre del vendedor para visualizar su perfil correspondiente, reputación, productos en activos y su horario de atención.

RQNF17.1: El sistema debe mostrar en el perfil únicamente datos públicos del vendedor (nombre, reputación, productos activos y horario de atención).

RQNF17.2: El sistema muestra en el perfil del vendedor las publicaciones disponibles y si no esta en horario de atención se presentan en modo de solo consulta.

RQNF17.3: El sistema marca una publicación como no disponible por horario cuando la fecha y hora actuales (zona centro, GMT-6) quedan fuera de los horarios de disponibilidad que el vendedor guardó, y como disponible cuando quedan dentro.

RQF17.1: El usuario cliente visualiza los productos de un vendedor en modo de solo consulta, sin el botón “Entrar en la fila”, junto con la fecha y hora de inicio del próximo bloque de atención, cuando el bloque de atención del vendedor no está vigente.

RQNF17.4: El sistema debe impedir el registro del cliente en la fila virtual de cualquier producto del vendedor mientras su bloque de atención no esté vigente, sin ocultar ni eliminar las publicaciones.

RQF19: El usuario cliente consulta su posición actual en la fila virtual de cada producto mientras espera su turno, mediante un indicador flotante en forma de burbuja que se actualiza en tiempo real.

RQNF19.1: El sistema debe calcular la posición del cliente con base en el orden FIFO de la fila (RQNF16.1).

RQNF19.2: El sistema debe actualizar la posición mostrada, sin que el cliente recargue la página, cada vez que otro usuario sale de la fila o la abandona.

RQNF19.3: El sistema debe retirar automáticamente al cliente de la fila una vez que su venta se concluya de manera exitosa.

RQF19.1: El usuario cliente visualiza en pantalla una notificación emergente con el mensaje "Producto no disponible: un usuario previo ha concretado la compra", mostrándole una opcion de aceptar. Seguida del retiro automático del elemento de su lista de filas activas y la desaparición de su correspondiente indicador flotante.

RQNF19.4: El sistema cierra la fila virtual de un producto en el momento en que se concluye su venta, sin importar la posición que ocupaba el cliente que concretó la compra, y retira de ella a todos los clientes que seguían en espera.

RQNF19.5: El sistema debe desplegar el aviso informativo de indisponibilidad al cliente en espera después de que se confirme la venta, eliminando el registro de la fila de la vista de filas activas del usuario, removiendo el componente visual del indicador flotante (burbuja de estado) del DOM de la interfaz y actualizando el contador de filas simultáneas del usuario a
N−1
.

RQF20: El usuario cliente registra su correo electrónico y selecciona las categorías de su interés para recibir alertas automáticas sobre productos nuevos en esas categorías.

RQNF20.1: El sistema debe validar que el correo electrónico xsea usuario@correo.com y que se haya seleccionado al menos una categoría.

RQNF20.2: El sistema debe guardar el correo electrónico del cliente y la selección de categorías.

RQF20.2: El usuario cliente recibe por correo electrónico las publicaciones nuevas de las categorías que seleccionó

RQNF20.4: El sistema debe enviar estas notificaciones a las 10:00 y a las 17:00 (GMT-6).

RQNF20.5: El sistema debe agrupar en un solo correo las publicaciones nuevas publicadas desde el envío anterior, y no enviar correo si no hay publicaciones nuevas.

RQF21: El usuario cliente completa el pago mediante el panel de PayPal.

RQNF18: El sistema debe redirigir al comprador a la pantalla de pago de PayPal.

RQF21.1: El usuario cliente visualiza su código de confirmación de entrega en cuanto PayPal confirma su pago.

RQNF21.2: El sistema procesa la aprobación del pago mediante el webhook de PayPal.

RQNF21.2: El sistema debe recibir la confirmación de pago de PayPal.

RQNF21.3: El sistema genera un código de confirmación de entrega único por transacción (4 dígitos numéricos, generado aleatoriamente y único entre códigos activos) al confirmarse el pago por PayPal.

RQNF21.4: El sistema debe mantener los fondos retenidos en escrow desde la confirmación del pago hasta el registro del código de entrega.

RQNF21.5: El sistema debe habilitar el chat de coordinación al confirmarse el pago por PayPal.

RQF22: El usuario cliente registra su comprobante acreditando el pago mediante el ingreso de la palabra clave asignada, el número de referencia de la transferencia (numérico, de 6 a 8 dígitos) y una fotografía o captura de pantalla del comprobante.

RQNF22.13: El sistema muestra el mensaje de error inmediatamente al detectar las fallas y sin enviar el comprobante al vendedor

RQNF22.1: El sistema valida que la palabra clave, el número de referencia y la imagen del comprobante estén completos antes de permitir el envío.

RQNF22.2: El sistema valida que la palabra clave ingresada coincida con la clave asignada a la sesión de pago del cliente.

RQNF22.3: El sistema permite únicamente los formatos .png, .jpeg y .jpg, con un tamaño mínimo de 420 × 540 y máximo de 2560 × 2560 píxeles, para la imagen del comprobante.

RQNF22.4: El sistema debe validar que el número de referencia ingresado por el cliente sea únicamente numérico y tenga entre 6 y 8 dígitos.

RQNF22.5: El sistema debe analizar la imagen del comprobante con la API de Google Cloud Vision mediante Document Text Detection (OCR) para extraer su texto, y verificar que el monto, la fecha y el número de referencia estén presentes y legibles, validando que el número de referencia extraído coincida con el ingresado por el cliente.

RQNF22.6: El sistema analiza la imagen con la API de Google Cloud Vision mediante SafeSearch Detection antes de mostrarla al vendedor y, si detecta contenido explícito o inapropiado, bloquea el envío del comprobante.

RQNF22.5: El sistema guarda la palabra clave, el número de referencia y la imagen del comprobante en el historial de la transacción.

RQF22.1: El usuario cliente visualiza la palabra clave asignada a su sesión de pago una vez que completa el pago en PayPal.

RQNF22.6: El sistema genera automáticamente una clave numérica única activas de 4 dígitos, por cada sesión de pago exitosa.

RQNF22.7: El sistema debe colocar la fila virtual del producto en estado de reposo una vez que el cliente envíe su comprobante de pago.

RQF22.3: El usuario cliente visualiza, al enviar su comprobante, un mensaje de que su comprobante está en revisión por el vendedor y que su lugar en la fila quedó en pausa.

RQNF22.9: El sistema coloca la fila virtual del producto en estado de reposo cuando el cliente registra su comprobante, conservando el turno.

RQF23: El usuario cliente realiza un reporte hacia el vendedor cuando su comprobante de pago es rechazado e ingresa una descripción obligatoria.

RQNF23.1: El sistema permite generar el reporte únicamente cuando el comprobante del cliente tiene estado rechazado.

RQNF23.2: El sistema debe validar que el campo de texto de la descripción contenga un mínimo de 30 caracteres antes de habilitar el botón de envío del reporte.

RQF24: El usuario cliente y el usuario vendedor ingresan a un chat interno tras la confirmación del pago.

RQNF31: El sistema debe monitorear la interacción en el chat de coordinación mediante un cronómetro de inactividad que contabiliza únicamente las horas transcurridas dentro del bloque de horario de atención del vendedor, considerando "inactividad" como la falta de envío de mensajes por un periodo continuo superior a 24 horas hábiles del vendedor por cualquiera de las dos partes.

RQNF24.4: El sistema debe colocar la fila virtual en estado de reposo una vez que el cliente registre su comprobante de pago, otorgando simultáneamente un código de confirmación de entrega al comprador.

RQF24.2: El usuario vendedor registra su propuesta de entrega mediante un formulario, ingresando lugarfecha aproximada de entrega.

RQNF24.8: El sistema valida que el lugar, la fecha y la hora de entrega estén completos antes de permitir el envío de la propuesta.

RQNF24.9: El sistema valida que la hora de entrega coincida con el horario de coordinación de entrega registrado por el vendedor en la publicación.

Tendría que haber saber si lo enviamos a domicilio

RQNF24.11: El sistema cuenta 3 bloques de atención del vendedor desde la confirmación del comprobante y, si el vendedor no registra la propuesta de entrega, cancela la transacción y reembolsa al comprador mediante PayPal.

El producto queda activo o inactivo una vez se complete una venta o que sucede si se reembolsa

RQF24.3: El usuario comprador acepta o rechaza la propuesta de entrega.

RQNF24.3: El sistema debe restringir el acceso al chat hasta que sea aceptado o rechazado la propuesta.

RQNF24.4: El sistema guarda la información de entrega si el comprador acepta la propuesta de coordinación de entrega.

RQNF24.5: El sistema cuenta 3 bloques de atención del vendedor desde el registro de la propuesta y, si sigue sin ser aceptada ni rechazada, cancela la transacción y reembolsa al comprador mediante PayPal.

El producto queda activo o inactivo una vez se complete una venta o que sucede si se reembolsa

RQF24.4: El usuario vendedor visualiza un aviso de rechazo cuando el comprador rechaza la propuesta de entrega.

RQNF24.14: El sistema muestra el aviso en el momento en que el comprador registra el rechazo.

RQNF24.15: El sistema le solicita que vuelva a llenar la información para acordar una nueva propuesta; mediante el formulario del RQF24.2.

RQF24.1: El usuario cliente visualiza un mensaje de advertencia en pantalla antes de proceder al pago o al envío del comprobante, informándole que la atención y respuesta por parte del vendedor se brindará exclusivamente dentro de su bloque de horario de atención vigente.

RQNF24.1: El sistema debe consultar los horarios de atención registrados por el vendedor en la base de datos para determinar si la transacción se está realizando dentro o fuera del bloque activo.

RQNF24.1: El sistema debe desplegar la interfaz emergente de advertencia de forma obligatoria y condicionar la habilitación del botón de confirmación de envío únicamente hasta que el usuario cliente haya marcado la casilla de lectura y aceptación del aviso.

RQF24.7: El usuario vendedor visualiza en su panel de control el estado de liberación de fondos de la transacción (retenido, en proceso de liberación, liberado) una vez registrada la entrega.

RQNF24.19: El sistema consulta el estado de la retención/liberación de fondos directamente con PayPal mediante su API.

RQNF24.20: El sistema muestra el estado “en proceso de liberación” desde que se registra el código de confirmación de entrega hasta que PayPal confirma la transferencia, indicando que el tiempo de procesamiento.

RQNF24.21: El sistema actualiza el estado a “liberado” y notifica al vendedor únicamente cuando PayPal confirma la transferencia de fondos.

RQF25: El usuario cliente realiza reportes dirigidos a los administradores para notificar estafas, fotos inapropiadas, uso de palabras malsonantes o discriminación, llenando los campos: Compra relacionada (opcional), ¿Qué quieres reportar? (opciones: una publicación, un vendedor o un mensaje), Categoría (RQNF10.1) y Detalle (mínimo 30, máximo 500 caracteres).

Hacer un reporte que sea cosa por cosa, tipo que cada vendedor, cliente, producto y promocional tenga su apartado de reportar, para que sea manual., se le dice a que quieres reportar, seleccionar categoria de reporte.

Que las categoriaas concuerden con el 10.1

Realizar los demas revisados nuevamente por el sistema y los otros motivo son pues ahora si manuales.

RQNF25.2: El sistema debe enviar los reportes seleccionados como Otro motivo a los administradores para revisión manual.

RQNF25.3: El sistema limita las opciones del campo Categoría a las categorías de infracción definidas en el RQNF10.1.

RQNF25.4: El sistema valida que el campo Detalle contenga un mínimo de 30 y un máximo de 500 caracteres.

RQNF25.5: El sistema registra automáticamente el reporte en el historial del vendedor de la compra relacionada y le asigna los puntos de la categoría seleccionada conforme al RQNF10.1.

RQNF25.7: El sistema registra la fecha de creación del reporte (RQF13.2).

RQF25.1: El usuario cliente visua liza la confirmación de que su reporte fue enviado y el estado en que se encuentra.

RQNF25.8: El sistema muestra la confirmación después del envío del reporte.

RQNF25.9: El sistema actualiza el estado del reporte cuando este se resuelve.

RQF26: El usuario vendedor ingresa el código de confirmación de entrega para finalizar la transacción.

RQNF26.1: El sistema valida que el código ingresado coincida con el código de confirmación de entrega asociado a la transacción.

RQNF26: El sistema debe transferir el dinero al vendedor tras la confirmación del código.

RQNF24: El sistema debe cancelar la compra, gestionar el reembolso al comprador e informar la hora y el día de la resolución (esto sin contar el tiempo de días hábiles definido por PayPal) si el vendedor no confirma el comprobante antes de que finalice su siguiente bloque de horario de atención.

RQNF26.2: El sistema solicita a PayPal, mediante su API, la liberación de los fondos retenidos en escrow hacia la cuenta del vendedor tras la confirmación del código, salvo que exista un reporte o disputa activa sobre la transacción; la liberación queda en estado “en proceso” hasta que PayPal confirma la transferencia.

RQNF26: El sistema debe deshabilitar el chat de comunicación entre las partes inmediatamente después de que se registre el código de confirmación de entrega o en su defecto la cancelación.

RQNF26.3: El sistema marca la transacción como concluida y la publicación como vendida, y cierra la fila del producto.

RQF27: El usuario cliente califica al vendedor con una puntuación de 1 a 5 estrellas después de confirmada la entrega.

RQNF24.2: El sistema muestra un menú opcional al cliente para calificar el servicio del vendedor.

RQF27.1: El usuario cliente visualiza un menú opcional para calificar el servicio del vendedor.

RQNF27.4: El sistema muestra el menú después de que se registra el código de confirmación de entrega.

RQF28: El usuario cliente abandona voluntariamente la fila de un producto en cualquier momento.

RQNF28.1: El sistema retira al cliente de la fila y conserva el orden FIFO de los demás usuarios.

RQNF28.2: El sistema asigna el turno automáticamente al siguiente usuario en espera cuando el cliente que abandona ocupa el primer lugar.

RQNF28.3: El sistema descuenta en uno el conteo de filas virtuales activas del cliente que abandona.

RQNF28.4: El sistema registra como abandono la salida voluntaria de la fila y el vencimiento del tiempo límite de pago, para el cálculo de la tasa de abandono.

RQF28.1: El usuario cliente visualiza un aviso de que fue retirado de la fila cuando su comprobante es rechazado o no realiza el pago dentro del tiempo establecido.

RQNF28.5: El sistema retira el turno del cliente y lo elimina de la fila cuando vence el tiempo límite de pago asignado al producto sin que el cliente complete el pago.

RQNF28.6: El sistema asigna el turno automáticamente al siguiente usuario en espera cuando retira al cliente por comprobante rechazado (o por vencimiento del tiempo límite de pago.

RQNF28.7: El sistema descuenta en uno el conteo de filas virtuales activas del cliente retirado de la fila.

RQNF28.8: El sistema muestra el aviso en el momento en que retira al cliente e indica el motivo del retiro.

RQF29: El usuario cliente realiza preguntas en la sección pública de comentarios de una publicación promocional o inicia un chat personalizado si el vendedor lo permite.

RQNF29.1: El sistema permite comentar en una publicación promocional a todos los usuarios cuando el vendedor seleccionó “Sí” para habilitar comentarios.

RQNF29.2: El sistema permite iniciar un chat de consulta con el vendedor únicamente cuando el vendedor seleccionó “Sí”.

RQNF29.3: El sistema aplica la función de detección de contenido inapropiado (RQNF7.7) a los comentarios, a los mensajes del chat de consulta y a las respuestas del vendedor antes de publicarlos o enviarlos.

RQF29.1: El usuario vendedor responde los comentarios y los mensajes del chat de consulta de sus publicaciones promocionales.

RQNF29.4: El sistema permite al vendedor responder únicamente en las publicaciones promocionales que tienen habilitados los comentarios o el chat de consulta.

RQF29.3: Cualquier usuario visualiza los comentarios de una publicación promocional.

RQNF29.6: El sistema muestra los comentarios a todos los usuarios únicamente en las publicaciones con comentarios habilitados (RQNF9.

RQF31: El usuario vendedor visualiza en su panel de control la palabra clave, el número de referencia y la imagen del comprobante enviado por el cliente en turno, y confirma o rechaza el comprobante de pago.

RQNF31.2: El sistema muestra la imagen del comprobante al vendedor después de aprobar los análisis de los RQNF22.5 y RQNF22.

RQNF31.3: El sistema permite al vendedor confirmar o rechazar el comprobante únicamente mientras tiene estado “en revisión”.

RQNF31.4: El sistema registra la decisión del vendedor con su fecha y hora en el historial de la transacción.

RQNF31.4: El sistema registra la decisión del vendedor con su fecha y hora en el historial de la transacción.

RQNF31.5: El sistema habilita el registro de la propuesta de entrega (RQF24.2) cuando el vendedor confirma el comprobante.

RQNF31.6: El sistema reanuda la fila y retira el turno del cliente cuando el vendedor rechaza el comprobante.

RQF31.3: El usuario cliente visualiza un aviso de cancelación de la compra, de reembolso y de la fecha y hora de resolución cuando el vendedor no revisa su comprobante a tiempo.

RQNF31.10: El sistema cancela la compra y reanuda la fila, asignando el turno al siguiente usuario en espera, si el vendedor no confirma ni rechaza el comprobante antes de que finalice su siguiente bloque de horario de atención.

RQNF31.11: El sistema solicita a PayPal, mediante su API, el reembolso al comprador del monto retenido en escrow de la compra cancelada.

RQNF31.12: El sistema calcula la fecha y hora de resolución de la cancelación sin contar los días hábiles que PayPal define para acreditar el reembolso.

RQNF31.13: El sistema muestra el aviso en el momento en que cancela la compra.

RQF32: El usuario vendedor visualiza en su panel de control el estado de las filas de sus publicaciones, con el producto, el número de personas en espera y el estado del cliente en turno.

RQNF32.1: El sistema incluye únicamente las filas de las publicaciones que no han sido dadas de baja.

RQNF32.2: El sistema actualiza el número de personas en espera.

Módulo 4: Chat de coordinación de entrega

Requerimientos funcionales

Requerimientos no funcionales

RQF35: El usuario cliente y el usuario vendedor envían mensajes de texto dentro del chat de coordinación para acordar el lugar, fecha, hora y método de entrega; la fecha y hora acordadas deben registrarse posteriormente en el formulario del RQF24.2 para quedar guardadas.

RQNF35.1: El sistema permite el envío únicamente de mensajes de texto en el chat de coordinación.

RQNF35.2: El sistema aplica la función de detección de contenido inapropiado (RQNF7.7) a cada mensaje antes de enviarlo y bloquea el envío si detecta una coincidencia.

RQNF35.3: El sistema registra de forma permanente todos los mensajes enviados en el historial de la transacción, con emisor, fecha y hora, para mantener la evidencia auditable del proceso.

RQF35.1: El usuario cliente y el usuario vendedor visualizan los mensajes del chat de coordinación, con su emisor, fecha y hora, en orden cronológico.

RQNF35.4: El sistema muestra los mensajes a ambas partes.

RQNF35.5: El sistema ordena los mensajes cronológicamente por su fecha y hora de registro.

RQF35.2: El usuario cliente y el usuario vendedor visualizan un aviso cuando su mensaje es bloqueado por contenido inapropiado.

RQNF35.6: El sistema muestra el aviso después de bloquear el mensaje

Módulo 5: Gestión de usuarios y control administrativo

Requerimientos funcionales

Requerimientos no funcionales

RQF36: El usuario administrador consulta los datos de usuarios registrados, verifica su información general, suspende cuentas, reactiva usuarios y monitorea su historial de acciones.

RQNF32: El sistema debe retener de forma preventiva el pago en el esquema de escrow ante la presencia de reportes, disputas activas o evidencias de irregularidades antes de la confirmación de entrega.

RQNF37.1: El sistema debe asignar de forma automática 1 punto de infracción correspondiente a la categoría "Otro motivo" (conforme al RQNF10.1) al historial de reputación del vendedor únicamente cuando el usuario administrador confirme y apruebe el reporte; en caso de que el administrador lo rechace por improcedente, el sistema archivará el reporte sin modificar el puntaje del vendedor.

RQF37: El usuario administrador revisa las denuncias y reportes recibidos sobre fraude, publicaciones engañosas, lenguaje ofensivo, spam, discriminación o incumplimiento de entrega.

RQNF33: El sistema debe aplicar bloqueos temporales de forma automática basándose en el tipo de infracción cometida y el número de reincidencias, desbloqueando la cuenta de manera automática una vez concluido el periodo establecido.

RQF38: El usuario administrador consulta el historial de las filas virtuales, los pagos realizados o rechazados, los comprobantes enviados, los tiempos de respuesta y las transacciones asociadas.

RQNF34: El sistema debe incrementar progresivamente la duración de las sanciones automáticas ante la acumulación de múltiples faltas hasta aplicar una suspensión prolongada o indefinida.

RQF39: El usuario administrador audita el historial completo de mensajes del chat interno entre un comprador y un vendedor en caso de conflicto.

RQNF35: El sistema debe suspender indefinidamente y enviar a revisión administrativa las cuentas que incurran en faltas graves como fraude comprobado, suplantación de identidad, amenazas o envío de comprobantes falsos.

RQF40: El usuario administrador dictamina la resolución de disputas de reembolso evaluando las evidencias solicitadas a ambas partes como comprobantes de pago, fotografías del producto o capturas de pantalla de las conversaciones.

RQNF36: El sistema debe denegar nuevos registros de usuarios agregados a la lista negra validando la coincidencia de su Identificación Oficial o RFC.

RQNF37: El sistema debe suspender la cuenta del vendedor y reflejar un saldo pendiente por liquidar si la plataforma cubre económicamente un reembolso derivado de su responsabilidad directa en el incumplimiento de la entrega o en la descripción errónea del producto.

RQF14: [KO1.1]El usuario administrador consulta los informes globales de la plataforma que muestran la categoría más vendida, y la tasa de abandono de fila por categoría.

RQNF14: El sistema debe calcular la categoría más vendida como el total de productos vendidos (transacciones concluidas) agrupados por categoría, cada 1ro de mes.

RQNF14.2: En caso de empate en el total de ventas entre dos o más categorías, el sistema debe desempatar usando como criterio el total de ventas de esa categoría en el mes anterior, otorgando la posición superior a la de mayor venta previa, en dado caso de que haya nuevamente empate no se muestra.

RQNF14.2. [KO2.1]El sistema debe calcular la tasa de abandono de fila por categoría haciendo el promedio de la suma de los usuarios que se salieron de una fila o no completaron el pago dentro del tiempo establecido de cualquier producto de esa categoría, cada 1ro de mes.

RQNF38: El sistema debe condicionar la reactivación de una cuenta con saldo pendiente únicamente al momento en que el vendedor liquide la totalidad del adeudo económico con la plataforma.
