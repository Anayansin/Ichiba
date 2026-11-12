Estos son los requisitos/requerimientos funcionale y no funcionales que debe tener este proyecto, debes verificar qeu se cumplan todos al pie de la letra, si se necesita que yo haga algo de forma manual para completar al 100% alguno de estos debes indicarme el paso a paso de como hacerlo, al final debe tener Full BackOffice con Subscription GQL, y un MCP herramientas de back, asistente de back o lo que sea, el punto es que debe de estar implementado, se deben usar minimo 5 apis externas, auntomatizacion de los procesos de integracion y despleigue mediante CI/CD, las tecnologias /componente y su pila, merco de referencia en astro, libreria de componentes reactivos React, base de datos relacional postgresql base de datos no relacional mongodb, tipo de api graphql y mcp, integracion y despliegue continuo ci/cd

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

RQNF1.7: El sistema debe verificar que la contraseña de registro del vendedor cuente con una longitud mínima de 10 caracteres e incluya al menos una letra mayúscula, una letra minúscula, un número y un símbolo especial los cuales son los siguientes: !, @, #, $, %, &, *, -, _. 

RQNF1.8: El sistema debe extraer los datos de Nombre completo y CURP (los primeros 10 caracteres deben coincidir con el RFC) de las imágenes con structor. 

RQNF1.9: El sistema valida, al momento del registro de un nuevo usuario vendedor, que el RFC y los datos de la identificación oficial (INE) ingresados no coincidan con ningún registro de la lista negra generada por cancelaciones previas de cuenta; de existir coincidencia, debe denegar el registro. La misma denegación aplica cuando esos datos (o el teléfono o el correo) ya pertenecen a una cuenta registrada. 

RQF1.1: El usuario vendedor visualiza un mensaje de error indicando que su registro fue denegado, cuando su RFC o identificación oficial coincidan con un registro en la lista negra, o cuando sus datos ya pertenezcan a otra cuenta; el mensaje indica que los datos ingresados no pueden ser registrados y que puede comunicarse con los administradores si considera que se trata de un error. 

RQNF1.1: El sistema debe mostrar el mensaje de error de registro denegado de forma inmediata al intentar enviar el formulario, sin revelar al usuario los datos específicos que generaron la coincidencia con la lista negra, limitándose a indicar que los datos ingresados no pueden ser registrados. 

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

 

 

Módulo 2:  administración de catálogo (Vendedor) 

 

 

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

RQNF12: El sistema debe gestionar el orden de atención de los usuarios en la fila virtual estructurando una cola bajo el método estricto de FIFO (First In, First Out). 

 RQNF13: El sistema debe limitar el acceso simultáneo a un máximo de tres filas virtuales por usuario cliente.  

RQF16.1: El usuario cliente visualiza el mensaje informativo “Ya estás en 3 filas. Abandona una para continuar” cuando intenta ingresar a una cuarta fila simultánea. 

RQNF16.3: El sistema debe contar las filas virtuales activas del usuario cliente al presionar el botón “Entrar en la fila”, antes de registrar su lugar. 

RQNF16.4: El sistema debe impedir el registro del usuario cliente en una cuarta fila simultánea, manteniendo sin cambios sus tres filas actuales. 

RQF16.2: El usuario cliente visualiza, al colocar el cursor sobre un producto del panel principal, un indicador que señala si el artículo está disponible o inactivo por horario y, cuando está inactivo por horario, el horario de atención del vendedor,  

RQNF16.5: El sistema debe permitir que cualquier usuario cliente entre a la fila virtual de un producto disponible sin limitar el número de usuarios formados durante el tiempo de atención del vendedor. 

 

Este no va aquí, 

RQNF16.6: El sistema muestra en el panel principal los productos cuyo vendedor se encuentra fuera de su bloque de horario de atención, identificándolos como inactivos. 

RQNF16.7: El sistema despliega, al detectar el cursor sobre un producto, el indicador de disponibilidad (disponible o inactivo). 

RQNF16.8: El sistema deshabilita la opción "Entrar en la fila" en los productos inactivos. 

 

Este no va aquí. 

RQNF16.8: El sistema debe obtener la fecha y hora de inicio del siguiente bloque de atención a partir de los horarios de disponibilidad guardados por el vendedor, tomando el bloque inmediato posterior al vigente. 

sin posibilidad de ingresar a la fila de dicho producto. 

 

Checar donde va este qwey 

 

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

RQF19.1: El usuario cliente visualiza, cuando otro cliente concreta la compra del producto en cuya fila está formado, un aviso de que el producto ya no está disponible y de que fue retirado de la fila. 

 

Primero poner lo que ve el usuario y despues lo que hace el sistema  

RQNF19.4: El sistema cierra la fila virtual de un producto en el momento en que se concluye su venta, sin importar la posición que ocupaba el cliente que concretó la compra, y retira de ella a todos los clientes que seguían en espera. 

RQNF19.5: El sistema muestra el aviso de producto no disponible al cliente retirado de la fila, y elimina dicha fila de su lista de filas activas y su indicador flotante en forma de burbuja se modifica.   

 

Se modifica es ambiguo la ultima parte,  

 

RQF20: El usuario cliente registra su correo electrónico y selecciona las categorías de su interés para recibir alertas automáticas sobre productos nuevos en esas categorías. 

RQNF20.1: El sistema debe validar que el correo electrónico xsea usuario@correo.com y que se haya seleccionado al menos una categoría. 

RQNF20.2: El sistema debe guardar el correo electrónico del cliente y la selección de categorías. 

RQF20.2: El usuario cliente recibe por correo electrónico las publicaciones nuevas de las categorías que seleccionó 

RQNF20.4: El sistema debe enviar estas notificaciones a las 10:00 y a las 17:00 (GMT-6). 

RQNF20.5: El sistema debe agrupar en un solo correo las publicaciones nuevas publicadas desde el envío anterior, y no enviar correo si no hay publicaciones nuevas. 

RQF21: El usuario cliente completa el pago mediante el panel de PayPal. 

RQNF18: El sistema debe redirigir al comprador a la pantalla de pago de PayPal. 

RQF22: El usuario cliente registra su comprobante acreditando el pago mediante el ingreso de la palabra clave asignada, el número de referencia de la transferencia y una fotografía o captura de pantalla del comprobante.  

RQNF22.1: El sistema valida que la palabra clave, el número de referencia y la imagen del comprobante estén completos antes de permitir el envío. 

RQNF22.2: El sistema valida que la palabra clave ingresada coincida con la clave asignada a la sesión de pago del cliente. 

RQNF22.3: El sistema permite únicamente los formatos .png, .jpeg y .jpg, con un tamaño mínimo de 420 × 540 y máximo de 2560 × 2560 píxeles, para la imagen del comprobante. 

RQNF22.4: El sistema analiza la imagen del comprobante con la API de Google Cloud Vision (SafeSearch Detection) antes de mostrarla al vendedor y bloquea su envío si detecta contenido inapropiado. 

 

Validar el que estamos validamos, en este apartado, revisar que sea el ticket.  

RQNF22.5: El sistema guarda la palabra clave, el número de referencia y la imagen del comprobante en el historial de la transacción. 


RQF22.1: El usuario cliente visualiza la palabra clave asignada a su sesión de pago una vez que completa el pago en PayPal. 

RQNF22.6: El sistema genera automáticamente una clave numérica única activas de 4 dígitos, por cada sesión de pago exitosa.  


Requerimeintos no revisados por quien autoriza el proyecto pero funcionales como base para continuar el proyecto, estos puedes tratar de ayudarme a mejorarlos, algunos requerimientos tienen referencia a otro sin embargo los numeros de estos no estan en orden, cada pregunta o duda que quiera hacreme debes hacerla:

RQF23: El usuario cliente realiza un reporte hacia el vendedor si su comprobante de pago es rechazado. RQNF23.1: El sistema debe verificar el reporte y, si aplica, mostrarlo en su reputación, o en su defecto rechazar el reporte.
RQNF23.2: El sistema debe permitir que la fila siga, aun después de un rechazo de pago.
RQF24: El usuario cliente y el usuario vendedor ingresan a un chat interno para coordinar los detalles de la entrega tras la confirmación del pago. RQNF24.1: El sistema debe advertir al usuario si realiza un pago o él envió de un comprobante de pago indicando que la atención será únicamente dentro del bloque de horario de atención vigente del vendedor.
RQNF31: El sistema debe cancelar la transacción y gestionar el reembolso automático al comprador si se detecta inactividad prolongada en el chat por cualquiera de las partes.
RQNF24.2: El sistema debe bloquear el chat a partir de mandar el comprobante de pago hasta que el vendedor compruebe el comprobante.
RQNF27: El sistema debe liberar los fondos retenidos en escrow hacia la cuenta de PayPal del vendedor al registrarse correctamente el código de confirmación de entrega.
RQNF24.4: El sistema debe colocar la fila virtual en estado de reposo una vez que el cliente registre su comprobante de pago, otorgando simultáneamente un código de confirmación de entrega al comprador.
RQF25: El usuario cliente realiza reportes dirigidos a los administradores para notificar estafas, fotos inapropiadas, uso de palabras malsonantes o discriminación. RQNF25.1: El sistema debe realizar de forma automática los reportes de los clientes, si el reporte es de carácter diferente a los definidos, este será revisado manualmente por un administrador.
RQF26: El usuario cliente otorga el código de confirmación de entrega al vendedor para finalizar la transacción. RQNF26: El sistema debe liberar el dinero tras la confirmación del código.
RQNF24: El sistema debe cancelar la compra de forma automática, gestionar el reembolso al comprador e informar la hora y el día de la resolución si el vendedor no confirma el comprobante antes de que finalice su siguiente bloque de horario de atención.
RQNF26: El sistema debe deshabilitar el chat de comunicación entre las partes inmediatamente después de que se registre el código de confirmación de entrega o en su defecto la cancelación.
RQF27: El usuario cliente califica al vendedor con una puntuación de 1 a 5 estrellas considerando sus servicios, comunicación y atención después de confirmada la entrega. RQNF24.2: El sistema muestra un menú opcional al cliente para calificar, de entre 1 a 5 estrellas, el servicio del vendedor.
RQF28: El usuario cliente abandona voluntariamente la fila de un producto en cualquier momento. RQNF23: El sistema debe retirar el turno, eliminar de la fila al usuario actual y asignar el turno automáticamente al siguiente usuario en espera si el comprobante es rechazado o si el cliente no realiza el pago dentro del tiempo establecido.
RQF29: El usuario cliente realiza preguntas en la sección pública de comentarios de una publicación promocional o inicia un chat personalizado si el vendedor lo permite. RQNF24.2: El sistema debe mostrar los comentarios disponibles para todos los usuarios.
RQNF24.2: El sistema debe permitir que todos los usuarios puedan comentar en una publicación.
RQNF24.2: El sistema permite a todos los usuarios iniciar un chat con el vendedor solo si el vendedor lo permite.
RQF30: El usuario vendedor revisa la referencia de pago y la imagen adjunta enviada por el cliente en turno desde el chat con él mismo. RQNF24.2: El sistema debe desbloquear el chat si el comprobante es confirmado.
RQNF24.2: El sistema debe des pausar la fila si el comprobante es rechazado.
RQF31: El usuario vendedor confirma o rechaza el comprobante de pago recibido. RQNF28: El sistema debe revertir los fondos y realizar el reembolso al comprador si el vendedor no efectúa la entrega del producto dentro del tiempo estipulado.
RQNF24.2: El sistema debe permitir al vendedor rechazar o confirmar el comprobante de pago.
RQF32: El usuario vendedor consulta el estado de la fila visualizando el número de personas en espera. RQNF24.2: El sistema debe mostrar el estado de las filas desde el panel de control del usuario vendedor.
RQNF24.2: El sistema debe mostrar solo las filas de productos activos.
RQF33: El usuario vendedor registra el código de confirmación de entrega proporcionado por el cliente el día de la entrega del producto. RQNF24.2: El sistema valida el código de confirmación de entrega para desbloquear el dinero de la venta.

Módulo 4: Chat de coordinación de entrega

Requerimientos funcionales Requerimientos no funcionales
RQF35: El usuario cliente y el usuario vendedor envían mensajes de texto dentro del chat interno para acordar el lugar, fecha, hora y método de entrega. RQNF29: El sistema debe habilitar el chat de coordinación exclusivamente cuando el pago haya sido confirmado por el vendedor y se haya asociado el código de acceso de la transacción.
RQNF30: El sistema debe registrar de forma permanente todos los mensajes enviados en el historial de la transacción para mantener la evidencia auditable del proceso.

Módulo 5: Gestión de usuarios y control administrativo

Requerimientos funcionales Requerimientos no funcionales
RQF36: El usuario administrador consulta los datos de usuarios registrados, verifica su información general, suspende cuentas, reactiva usuarios y monitorea su historial de acciones. RQNF32: El sistema debe retener de forma preventiva el pago en el esquema de escrow ante la presencia de reportes, disputas activas o evidencias de irregularidades antes de la confirmación de entrega.
RQF37: El usuario administrador revisa las denuncias y reportes recibidos sobre fraude, publicaciones engañosas, lenguaje ofensivo, spam, discriminación o incumplimiento de entrega. RQNF33: El sistema debe aplicar bloqueos temporales de forma automática basándose en el tipo de infracción cometida y el número de reincidencias, desbloqueando la cuenta de manera automática una vez concluido el periodo establecido.
RQF38: El usuario administrador consulta el historial de las filas virtuales, los pagos realizados o rechazados, los comprobantes enviados, los tiempos de respuesta y las transacciones asociadas. RQNF34: El sistema debe incrementar progresivamente la duración de las sanciones automáticas ante la acumulación de múltiples faltas hasta aplicar una suspensión prolongada o indefinida.
RQF39: El usuario administrador audita el historial completo de mensajes del chat interno entre un comprador y un vendedor en caso de conflicto. RQNF35: El sistema debe suspender indefinidamente y enviar a revisión administrativa las cuentas que incurran en faltas graves como fraude comprobado, suplantación de identidad, amenazas o envío de comprobantes falsos.
RQF40: El usuario administrador dictamina la resolución de disputas de reembolso evaluando las evidencias solicitadas a ambas partes como comprobantes de pago, fotografías del producto o capturas de pantalla de las conversaciones. RQNF36: El sistema debe denegar nuevos registros de usuarios agregados a la lista negra validando la coincidencia de su Identificación Oficial o RFC.
RQNF37: El sistema debe suspender la cuenta del vendedor y reflejar un saldo pendiente por liquidar si la plataforma cubre económicamente un reembolso derivado de su responsabilidad directa en el incumplimiento de la entrega o en la descripción errónea del producto.
RQNF38: El sistema debe condicionar la reactivación de una cuenta con saldo pendiente únicamente al momento en que el vendedor liquide la totalidad del adeudo económico con la plataforma.

cuando concluyas con todo esto debes realizar la domentacion completa en el archivo documentacion que tu creaste, este debe ser muy explicito, y facil de entender para alguien que no sabe nada de programacion ni de este proyecto, tambien debes actualizar el archivo de inventario cumpliendo las mismas especificaciones, ya por ultimo al final de este mismo archivo, sin eliminar nada debes poner todos los requerimetos uno por uno explicando donde y como se implementa, esto se hace con el funcional y sus no funcionales.

---

# ANEXO — Trazabilidad de requisitos (dónde y cómo se implementa cada uno)

> Este anexo se agregó **al final del archivo, sin eliminar nada** de lo anterior. Recorre todos los requerimientos del documento, uno por uno (funcionales y no funcionales), indicando: qué pide, **dónde vive en el código** y **cómo se comprueba**. Las suites de prueba están en `backend/scripts/`; la documentación general está en `DOCUMENTACION.md` y el inventario de herramientas en `INVENTARIO.md`. Estado actual: fases 1 a 7c terminadas, 8 suites con **296 pruebas en verde** (+48 de moderación +7 de comisión/PayPal) y `npx tsc --noEmit` limpio en backend y frontend.

## Requisitos generales (párrafo de introducción)

**Full BackOffice con Subscription GQL.** El panel de administración (`frontend/Ichiba/src/pages/Admin/`) tiene nueve secciones (Inicio/dashboard, Gestión de usuarios, Reportes pendientes, Disputas y retenciones, Adeudos, Informes globales, Lista negra, Solicitudes de registro y Trazabilidad) y se actualiza **en vivo** con suscripciones GraphQL por WebSocket: `resumenAdmin`, `reportesPendientes`, `usuariosAdmin`, `listaNegraActualizada`, `solicitudesRegistro` y `disputasActualizadas` (`backend/src/graphql/servidorSuscripciones.ts`, `suscripciones.ts`; consumidas por `frontend/Ichiba/src/services/suscripcionesService.ts`). Prueba: `scripts/probar-suscripciones.ts` (11/11).

**MCP de BackOffice.** Servidor MCP con **18 herramientas** que operan el BackOffice (resumen, usuarios, reportes, lista negra, historial, auditoría de chat, disputas, ventas retenidas, adeudos e informes globales), con doble transporte: stdio (`npm run mcp`) y HTTP en `/mcp` (solo administradores). Código: `backend/src/mcp/servidorMcp.ts`, `rutasMcp.ts`, `arranqueStdio.ts`; motor compartido: `backend/src/services/backofficeService.ts`. Prueba: `scripts/probar-mcp.ts` (22/22).

**Mínimo 5 APIs externas.** Se usan **6**: PayPal Checkout v2 (`services/paypalService.ts`), MercadoPago Checkout API con Payment Brick embebido (`services/mercadopagoService.ts`), StructOCR (`services/structOcrService.ts`), Gmail SMTP (`services/emailService.ts`) y Google Cloud Vision (`services/visionService.ts`), más el panel de PayPal para la cuenta compradora de prueba.

**Stack y CI/CD.** Astro (`front-astro/`), React (`frontend/Ichiba/`), PostgreSQL (Prisma 8, `backend/src/prisma/contract.prisma`), MongoDB (Mongoose, `backend/src/models/`), GraphQL (Apollo + suscripciones), MCP y CI/CD con GitHub Actions (`.github/workflows/integracion-continua.yml` corre las 8 suites y compila ambos frontends; `.github/workflows/despliegue.yml` publica en Railway y Vercel al terminar en verde, como vía alternativa). El despliegue automático está activo por integración directa con GitHub: Railway auto-despliega el backend (con migraciones automáticas) y Vercel publica la tienda con cada push a `main` (verificado el 16/10/2026).

## Módulo 1: Registro y autentificación

**RQF1 — Registro del vendedor con nombre, domicilio, teléfono, correo, RFC, 2 imágenes de la INE y contraseña.**
- Dónde: `backend/src/routes/usuarioRoutes.ts` (`POST /api/usuarios/registro`), `backend/src/controllers/usuarioController.ts`, `backend/src/middleware/uploadIne.ts` (dos campos: `ineFrente` e `ineReverso`), `backend/src/services/ineService.ts` y `structOcrService.ts`; frontend en `frontend/Ichiba/src/pages/RegistrarCuenta`.
- Cómo: el formulario exige todos los campos y las dos fotografías; el backend guarda la cuenta en PostgreSQL y su espejo en MongoDB, con la contraseña cifrada con bcryptjs.

**RQNF1.1 — Validar que todos los campos del registro estén completos.**
- Dónde: validaciones del controlador de registro + formulario `RegistrarCuenta.tsx`.
- Cómo: cada campo faltante responde 400 con mensaje claro y el formulario no deja enviar hasta completarlos.

**RQNF1.2 — El teléfono debe tener 10 dígitos.**
- Dónde: validación del registro en `usuarioController.ts` y en el formulario.
- Cómo: se rechaza cualquier teléfono que no tenga exactamente 10 dígitos.

**RQNF1.3 — Código de confirmación numérico de 4 dígitos por correo.**
- Dónde: `backend/src/utils/generarCodigo.ts` (genera entre 1000 y 9999), `backend/src/controllers/verificacionController.ts` (`POST /api/verificacion/correo/enviar` y `/correo/verificar`, vigencia 10 minutos), correo `enviarCorreoVerificacion`; frontend `components/VerificacionModal` (campo de 4 dígitos).
- Cómo: se guarda el código en PostgreSQL y su espejo, se envía por Gmail (o se imprime en consola en modo local) y al verificarlo la cuenta queda `correoVerificado: true`.

**RQNF1.4 — El RFC debe coincidir con los primeros 10 caracteres de la CURP de la INE.**
- Dónde: `backend/src/utils/validarRfcCurp.ts` y `backend/src/services/ineService.ts`.
- Cómo: la CURP se lee de la INE con StructOCR y se compara contra el RFC capturado; si no coinciden, el registro se rechaza.

**RQNF1.5 — El nombre completo debe coincidir con la INE.**
- Dónde: `backend/src/services/ineService.ts`.
- Cómo: se compara el nombre capturado contra el leído por StructOCR y se rechaza el alta si no coincide.

**RQNF1.6 — Solo formatos .png/.jpeg/.jpg con mínimo 420 × 540 px en las dos imágenes de INE.**
- Dónde: `backend/src/middleware/uploadIne.ts` (filtro de formato y peso) e `ineService.ts` (dimensiones con Sharp).
- Cómo: Multer rechaza otros formatos con JSON 400 y el servicio verifica dimensiones y nitidez antes de continuar.

**RQNF1.7 — Contraseña de mínimo 10 caracteres con mayúscula, minúscula, número y símbolo (! @ # $ % & * - _).**
- Dónde: `backend/src/utils/validarPassword.ts` y el formulario de registro.
- Cómo: se valida en el navegador y otra vez en el backend; los símbolos permitidos son exactamente los listados.

**RQNF1.8 — Extraer nombre completo y CURP de las imágenes con StructOCR.**
- Dónde: `backend/src/services/structOcrService.ts` (llamada a la API) e `ineService.ts` (orquestación).
- Cómo: se analiza el frente (datos) y el reverso (código/MRZ) de la INE durante el registro.

**RQNF1.9 — Denegar el registro si el RFC o los datos de la INE están en la lista negra.**
- Dónde: `backend/src/services/listaNegraService.ts` y modelo `backend/src/models/ListaNegra.ts`; la decisión completa vive en `backend/src/services/bloqueoRegistroService.ts` (`revisarBloqueoDeRegistro`), que consulta desde el registro (`usuarioController.ts`).
- Cómo: si el RFC, la CURP, el código del reverso de la INE o el correo coinciden con una entrada de la lista negra, el alta se deniega; también se deniega si el RFC, la CURP, el código de la INE o el teléfono ya pertenecen a otra cuenta, y si el correo ya tiene una cuenta registrada. La respuesta es 403 con `codigo: "DATOS_NO_REGISTRABLES"` y el motivo interno (`lista-negra`, `datos-en-uso`, `correo-en-uso`), que no se muestra al usuario. Pruebas: `scripts/probar-puntos-cancelacion.ts` (48/48, lista negra y denegación) y `scripts/probar-bloqueo-registro.ts` (6/6).

**RQF1.1 — Mensaje de error de registro denegado cuando hay coincidencia en la lista negra.**
- Dónde: `usuarioController.ts` (respuesta del registro) y `RegistrarCuenta.tsx` (bloque de aviso `registro-bloqueo`).

**RQNF1.1 — El mensaje de denegación es inmediato y no revela qué dato coincidió.**
- Cómo: el backend responde un mensaje genérico ("Los datos ingresados no pueden ser registrados. Si consideras que se trata de un error, comunícate con los administradores."), sin indicar el campo específico; el formulario lo muestra en el momento. (El mismo criterio aplica en el rechazo por INE o RFC duplicado.)

**Solicitud de revisión del alta denegada (complemento de RQNF1.9 y RQF1.1).**
- Dónde: `backend/src/services/bloqueoRegistroService.ts` (`crearSolicitudDeRevision`, `listarSolicitudesDeRevision`, `resolverSolicitudDeRevision`), modelo `backend/src/models/SolicitudRegistroBloqueado.ts`, `POST /api/usuarios/registro/solicitar-revision` (público), `GET /api/admin/solicitudes-registro` y `POST /api/admin/solicitudes-registro/:id/resolver`; en el frontend `RegistrarCuenta.tsx` y la sección **Solicitudes de registro** del BackOffice (`src/pages/Admin/SolicitudesRegistro.tsx`).
- Cómo: la persona a la que se le denegó el alta puede escribir qué ocurrió y enviar la solicitud; queda registrada en MongoDB, se avisa por correo a los administradores (`CORREO_ADMINISTRADORES`, o el buzón de la plataforma) y llega en vivo al panel por la suscripción `solicitudesRegistro`. El administrador la pone en revisión, la autoriza o la descarta, y su respuesta se manda por correo a la persona. Prueba: `scripts/probar-solicitud-revision.ts` (4/4).

**RQF2 — Casilla de aceptación para recibir notificaciones del estado de usuario, la fila virtual y los pagos.**
- Dónde: campo `recibirNotificacionesCriticas` del modelo `usuario` (PostgreSQL y espejo MongoDB); checkbox en `RegistrarCuenta.tsx`; usado por todos los correos de fila/ventas (`emailService.ts`).

**RQNF2.1 — No permitir el registro si no acepta estas notificaciones.**
- Dónde: `usuarioController.ts` (línea ~180: `recibirNotificacionesCriticas !== "true"` → 400).
- Cómo: sin la casilla marcada el alta se rechaza; no hay forma de saltarse la regla desde la API.

**RQNF2.2 — Permitir continuar el registro si acepta.**
- Cómo: con la casilla marcada el flujo continúa a la verificación de correo y al resto del alta.

**RQNF2.3 — Guardar la selección de la casilla.**
- Dónde: se guarda en PostgreSQL y se refleja en MongoDB; también se puede actualizar luego desde `PUT /api/usuarios/preferencias`.

**RQF3 — Casilla para aceptar notificaciones de comentarios en publicaciones publicitarias.**
- Dónde: campo `recibirNotificacionesPublicitarias` del modelo `usuario`; checkbox en el registro.

**RQNF3 — Guardar la selección de la casilla.**
- Cómo: se guarda en ambas bases y la lee `comentarioController.ts` para decidir si envía `enviarCorreoComentarioPublicitario`.

**RQF4 — Redirigir al vendedor a la pasarela oficial de PayPal con OAuth 2.0 para vincular su cuenta.**
- Dónde: `backend/src/controllers/paypalVinculacionController.ts` (`POST /api/pagos/paypal/vincular` genera un `state` aleatorio de un solo uso y redirige a `www.sandbox.paypal.com/webapps/oauth2/authorize`; `GET /api/pagos/paypal/vincular/callback` intercambia el `code` por el Token de Acceso y obtiene el `payer_id` = Merchant ID); tarjeta *Cuenta de PayPal* del panel del vendedor.

**RQNF4 — Guardar el Token de Acceso cifrado (Merchant ID) para gestionar los fondos bajo escrow.**
- Dónde: `backend/src/services/cifradoService.ts` (AES-256-GCM con la llave `PAYPAL_LLAVE_CIFRADO`) y modelo `backend/src/models/VinculoPayPal.ts`; la orden de pago usa el Merchant ID (`paypalService.ts`), y el escrow (autorización + captura diferida) vive en `backend/src/services/escrowService.ts`. Prueba: `scripts/probar-escrow.ts` (64/64).

**RQF5 — Definir disponibilidad de atención con días y rangos de 05:00 a 23:59 (GMT-6).**
- Dónde: `frontend/Ichiba/src/components/SelectorHorario` y `pages/HorarioVendedor`; `backend/src/utils/validarHorario.ts`.

**RQNF5.1 — Guardar los horarios en formato de 24 horas.**
- Dónde: campo `horarios` (JSON) del modelo `usuario`; validación en `validarHorario.ts`.

**RQNF5.2 — Horario de atención mínimo de 1 hora a la semana.**
- Dónde: `backend/src/utils/validarHorario.ts` (línea ~154: "Debes tener al menos 1 hora de disponibilidad a la semana") y el formulario (`RegistrarCuenta.tsx`).
- Cómo: la suma de los bloques semanales debe llegar a 60 minutos; si no, no deja guardar.

**RQNF5.3 — Confirmación obligatoria del horario cada 1° de mes.**
- Dónde: `PUT /api/usuarios/confirmar-horario` (`usuarioController.confirmarHorario`), campo `horarioConfirmadoEn`; frontend `components/ModalConfirmacionHorario` (bloquea el panel hasta confirmar) y `middleware/verificado.ts`.
- Cómo: publicar o editar catálogo exige el horario confirmado del mes en curso, medido en GMT-6.

**RQNF5.4 — Guardar la confirmación o el conteo de no confirmaciones.**
- Dónde: `horarioConfirmadoEn` y `diasSinConfirmarHorario` del modelo `usuario`; los actualiza `jobs/revisionHorarios.ts`.

**RQF6 — Actualizar, confirmar o modificar los horarios de atención.**
- Dónde: `pages/HorarioVendedor` (frontend) y `PUT /api/usuarios/confirmar-horario` (backend).

**RQNF6.1 — Hacer las actualizaciones correspondientes si existe un cambio.**
- Cómo: cada guardado valida y escribe los nuevos bloques en ambas bases (PostgreSQL y espejo MongoDB).

**RQNF6.2 — Horario mínimo de 1 hora a la semana (al modificar).**
- Dónde: misma validación de `validarHorario.ts` aplicada en la modificación.

**RQNF6.3 — Aviso 15 días antes de la eliminación de la cuenta.**
- Dónde: `backend/src/jobs/revisionHorarios.ts` + `enviarCorreoAdvertencia` ("Aviso: tu cuenta se eliminará el próximo 1ro de mes").
- Cómo: el job diario (08:00 GMT-6) revisa los días sin confirmar y manda el aviso cuando corresponde.

**RQNF6.4 — Contar 2 faltas de confirmación para enviar el aviso de eliminación.**
- Dónde: `revisionHorarios.ts` (conteo mensual) y correo de aviso de eliminación.

**RQNF6.5 — Eliminar la cuenta el 1° de mes con 2 faltas seguidas.**
- Dónde: `revisionHorarios.ts` (el 1° de mes cuenta las faltas y con 2 envía el aviso y borra la cuenta ese mismo día).

**RQNF6.6 — Eliminar todos los registros del usuario sin posibilidad de recuperarlos.**
- Dónde: borrado total en PostgreSQL, MongoDB y archivos (`uploads`) desde `revisionHorarios.ts`; para cuentas canceladas por puntos lo hace `backend/src/services/cancelacionCuentaService.ts`. Prueba: `scripts/probar-eliminacion-vendedor.ts` y `probar-puntos-cancelacion.ts`.

**RQF6 — Si el vendedor no confirma su horario, restringir publicación y edición de catálogo.**
- Dónde: `backend/src/middleware/verificado.ts` (exige correo verificado y horario confirmado del mes) en las rutas de productos/promocionales; frontend `ModalConfirmacionHorario`.

**RQNF6 — Restringir el acceso a esas funciones hasta que confirme.**
- Cómo: las rutas de crear/editar/archivar/eliminar productos y promocionales responden 403 hasta confirmar; al confirmar, el acceso se restablece al instante.

**RQF6 — Inicio de sesión con correo y contraseña.**
- Dónde: `POST /api/usuarios/login` (`usuarioController.iniciarSesion`); frontend `components/auth/IniciarSesionModal`.

**RQNF6 — Autenticar contra MongoDB con contraseñas cifradas con bcryptjs.**
- Dónde: modelo `backend/src/models/usuario.ts` (colección `usuario` de MongoDB) y comparación `bcrypt.compare` en el login.
- Cómo: la contraseña nunca se guarda en texto plano; el login lee el espejo de MongoDB y emite el JWT.

## Módulo 2: Administración de catálogo (Vendedor)

**RQF7 — Publicar producto con nombre, precio, descripción, condiciones de uso, fotografía, método de entrega, rango horario y tiempo límite de pago.**
- Dónde: `backend/src/routes/productoRoutes.ts` (`POST /api/productos`), `backend/src/controllers/productoController.ts`, modelo `backend/src/models/producto.ts`; frontend `pages/RegistrarProducto`.

**RQNF7.1 — Validar que todos los campos estén completos.**
- Dónde: validaciones de `productoController.ts` y del formulario; cada faltante responde 400 con el campo señalado.

**RQNF7.2 — Solo .png/.jpeg/.jpg de 420 × 540 a 2560 × 2560 px.**
- Dónde: `backend/src/middleware/upload.ts` (`subirFotosProducto`) y `services/imagenProductoService.ts` (dimensiones con Sharp). Pruebas 1 a 16 de `scripts/probar-moderacion-vision.ts`.

**RQNF7.3 (precio) — Precio entre $10 y $5,000.**
- Dónde: validación de `productoController.ts`; frontend valida igual. Prueba: `probar-moderacion-vision.ts` (casos de precio fuera de rango).

**RQNF7.4 (descripción) — Descripción de 30 a 100 caracteres contando espacios.**
- Dónde: validación de longitud en backend y formulario.

**RQNF7.5 (estado) — Selección obligatoria de la condición del artículo.**
- Dónde: campo `condicion` del producto; el backend rechaza sin selección.

**RQNF7.3 (Cloud Vision) — Moderar las fotos y bloquear objetos excluidos (carros, motos, casas, terrenos, mascotas, personas, armas, sustancias controladas o perecederos).**
- Dónde: `backend/src/services/visionService.ts` (`moderarFotosProducto`) llamado desde `productoController.ts`.
- Cómo: cada foto se analiza contra Cloud Vision; si detecta un objeto excluido, la publicación se bloquea y las imágenes subidas se borran. Si falta la llave o el servicio falla, también se bloquea (nunca se publica sin analizar). Pruebas: mock de Cloud Vision en `probar-moderacion-vision.ts`.

**RQNF7.3 (palabras no permitidas) — Comparar todo texto contra la lista de palabras no permitidas y bloquear el envío.**
- Dónde: `backend/src/utils/filtroPalabras.ts` (middleware global en `server.ts`) y `backend/src/configuracion/palabrasProhibidas.ts`.

**RQNF7.4 (tiempo límite) — Tiempo de pago de 30 minutos a 3 horas, por defecto 1 hora.**
- Dónde: `productoController.ts` (validación y valor por defecto); campo del producto que usa la fila al dar el turno.

**RQNF7.5 (guardar todo) — Guardar todos los campos del producto.**
- Dónde: modelo `producto.ts` (MongoDB) y su alta en `POST /api/productos`.

**RQF8 (alerta) — Avisar cuando un campo de texto coincide con una palabra no permitida e impedir el envío.**
- Dónde: `filtroPalabras.ts` responde 400 con `{ message, campo }`; el formulario muestra la alerta roja bajo el campo señalado (`frontend/Ichiba/src/utils/errores.ts`, `campoDeError`).

**RQNF8.1 [KO1.1] — Mostrar la alerta después de detectar la coincidencia.**
- Cómo: la alerta aparece inmediatamente al recibir la respuesta del backend. Pruebas 17 a 23 de `probar-moderacion-vision.ts`.

**RQNF8.2 — Permitir corregir el contenido y reintentar, sometiéndolo de nuevo a validación.**
- Cómo: el formulario enfoca el campo, deja corregir y al reenviar se repite toda la validación (incluidas palabras prohibidas y demás reglas).

**RQF8 (categorías) — Selección obligatoria de una categoría predefinida (Artesanías, Ropa segunda mano, Hogar, Electrodomésticos, Coleccionables u Otros).**
- Dónde: `backend/src/configuracion/categorias.ts` y validación `categoriaProductoValida` en `productoController.ts`; desplegable en `RegistrarProducto`/`EditarProducto` y `textoCategoria` en el frontend.

**RQNF8.1 (categoría) — Validar que exista la selección.**
- Cómo: sin categoría válida, crear o editar responde "Selecciona una categoría válida". Pruebas 24 a 27 de `probar-moderacion-vision.ts`.

**RQNF8.2 (categoría) — Guardar la selección.**
- Dónde: campo `categoria` del producto; se muestra en ficha, filtros y estadísticas.

**RQF9 — Promocionar un artículo con nombre, descripción, condición, fotografías, precio, chat/comentarios habilitables y cobertura de envío.**
- Dónde: `backend/src/routes/promocionalRoutes.ts`, `controllers/promocionalController.ts`, modelo `models/Promocional.ts`; frontend `pages/RegistrarPromocional`.

**RQNF9.1 — Validar que los campos no estén vacíos.**
- Dónde: validaciones de `promocionalController.ts` (imágenes, nombre 10-35, descripción 30-100, cobertura y condición obligatorias).

**RQNF9.2 — Solo .png/.jpeg/.jpg de 420 × 540 a 2560 × 2560 px.**
- Dónde: `subirFotosProducto` (mismo filtro estricto que productos) e `imagenProductoService`.

**RQNF9.3 — Moderación con Cloud Vision para objetos excluidos.**
- Dónde: misma función `visionService` que el RQNF7.3; los promocionales quedan exentos por diseño (su catálogo es para autos, casas, terrenos, etc.). Pruebas 28 a 33 de `probar-moderacion-vision.ts`.

**RQNF9.4 — Palabras no permitidas en todos los campos de texto.**
- Dónde: mismo filtro global + validación del controlador; el formulario señala el campo.

**RQNF9.5 — Precio mínimo $5,001 sin máximo.**
- Dónde: validación de `promocionalController.ts` (precio < 5001 → 400).

**RQNF10 — Alerta de palabra no permitida en promocionales, impidiendo el envío.**
- Dónde: mismas piezas que RQNF8 (filtro + `campoDeError`).

**RQNF10.1 — Mostrar la alerta inmediatamente después de detectar la coincidencia.**
- Cómo: la alerta se pinta bajo el campo señalado al recibir el 400.

**RQNF10.2 — Corregir y reintentar con nueva validación completa.**
- Cómo: idéntico al RQNF8.2 (reenvío validado de nuevo).

**RQF10 (reportes) — Reportar con motivo (comportamientos errados, estafas, fotos inapropiadas, comprobantes falsos, palabras malsonantes o discriminación) y descripción.**
- Dónde: `backend/src/routes/reporteRoutes.ts`, `controllers/reporteController.ts`, `backend/src/configuracion/categoriasReporte.ts`; frontend `pages/ReportarVendedor` y `ReportarComprador`.

**RQNF10.1 (puntos) — Reputación por puntos: 3 graves, 1.5 leves de trato directo, 1 otras leves.**
- Dónde: `backend/src/services/reputacionService.ts` y `sancionService.ts`; la tabla de puntos vive en `categoriasReporte.ts` y se muestra en la bandeja de reportes (incluido cuántos sumaría al confirmar). Prueba: `scripts/probar-puntos-cancelacion.ts`.

**RQNF10.3 — Sumar puntos y cancelar la cuenta al llegar a 8.**
- Dónde: `reputacionService.ts` (suma acumulativa) y `cancelacionCuentaService.ts` (cancelación permanente). Prueba: `probar-puntos-cancelacion.ts`.

**RQNF10.4 — Guardar los reportes con motivo "otro motivo".**
- Dónde: `reporteController.ts` (guarda el reporte con categoría `otro` aunque no esté tipificada) y modelo `Reporte.ts`.

**RQF11 [KO2.1] — Notificar por correo la cancelación permanente al llegar a 8 puntos.**
- Dónde: `enviarCorreoCuentaCancelada` ("Tu cuenta de Ichiba fue cancelada de forma permanente") disparado desde `cancelacionCuentaService.ts`.

**RQNF10.5 — Enviar la notificación cuando la suma sea 8, con motivo y reportes que la originaron.**
- Cómo: el correo incluye el motivo y la lista de reportes confirmados; se envía al alcanzar exactamente el umbral. Prueba: `probar-puntos-cancelacion.ts`.

**RQNF10.6 [KO3.1] — Eliminar toda la información personal al cancelar, conservando RFC e INE en la lista negra.**
- Dónde: `cancelacionCuentaService.ts` (purga de nombre, domicilio, teléfono, correo, contraseña, publicaciones, chats y token de PayPal; alta en `ListaNegra`) y `jobs/revisionEntregas.ts` (`purgarCuentasCanceladasResueltas` cuando ya no quedan entregas). Prueba: `probar-puntos-cancelacion.ts`.

**RQNF10.7 [KO4.1] — Cancelar las filas activas sin pago del vendedor cancelado, retirarlo y notificar al cliente.**
- Dónde: `cancelacionCuentaService.ts` (cierra las filas con motivo `cuenta_cancelada`) y `enviarCorreoProductoNoDisponible` ("El producto ya no está disponible").

**RQF12 (cuenta cancelada) — El vendedor cancelado solo accede a transacciones con pago confirmado para completar la entrega.**
- Dónde: `backend/src/middleware/vendedor.ts` (`requiereVendedorDeEntregas` permite solo las rutas de entregas; `rechazarCuentaCancelada` bloquea el resto).

**RQNF10.1 (solo entregas) — Permitir únicamente completar entregas pagadas antes de la cancelación (sin publicar, editar ni recibir clientes).**
- Cómo: las rutas de entrega siguen abiertas para esa cuenta y todo lo demás responde 403.

**RQNF10.2 — Cancelar la transacción y reembolsar vía PayPal si no registra el código de entrega en el plazo.**
- Dónde: `jobs/revisionEntregas.ts` + `escrowService.cancelarEscrow` (reembolso al comprador). Prueba: `probar-escrow.ts`.

**RQF10 (cliente) — El cliente ve cuando es retirado de una fila por cancelación del vendedor.**
- Dónde: correo `enviarCorreoProductoNoDisponible` y la fila desaparece de sus filas activas (`GET /api/colas/mias`; burbuja `ColaBubble`).

**RQNF10.1 (aviso) — Mostrar el aviso de producto no disponible y eliminar la fila de la lista de filas activas.**
- Cómo: la fila se cierra en PostgreSQL con motivo y el correo avisa al comprador; el frontend deja de listarla.

## Requerimientos no revisados (base para continuar)

**RQF11 (modificar) — Editar la información de una publicación (nombre, categoría, precio, descripción, condición, foto, método de entrega y rango horario).**
- Dónde: `PUT /api/productos/:id` (`productoController.ts`) y frontend `pages/EditarProducto`.

**RQNF11.1 — Impedir edición o eliminación si existe transacción activa o fila en curso.**
- Dónde: `productoController.ts` consulta ventas activas y filas del producto antes de editar/eliminar/archivar; si existen, responde 400/409 con mensaje.

**RQNF11.4 [KO5.1] — Revalidar cada campo editado con las mismas reglas de la publicación inicial (RQNF7).**
- Cómo: la edición pasa por la misma validación de campos, precios, descripciones, imágenes y palabras prohibidas que el alta.

**Dar de baja la publicación.** El vendedor archiva/activa su publicación con `PATCH /api/productos/:id/estado` (y elimina con `DELETE /api/productos/:id`); el estado se refleja en el panel y en el catálogo.

**RQF12 (panel) — Panel de control con estado activo/inactivo, filas en curso y vendidos, más la reputación por estrellas.**
- Dónde: `frontend/Ichiba/src/pages/PanelVendedor` (tarjetas de estado y filas) y `GET /api/productos/mios/lista`, `GET /api/pagos/vendedor/ventas`.

**RQNF12 — Calcular la reputación como promedio de las calificaciones de 1 a 5 estrellas.**
- Dónde: `backend/src/services/reputacionService.ts` (promedio con un decimal de `Venta.calificacionComprador`, enteros de 1 a 5) y endpoint `POST /api/pagos/:ventaId/calificar`. Prueba: `probar-escrow.ts` (calificación).

**RQF13 — Descargar en PDF los informes de ventas (total por período, productos vendidos, tiempo promedio por fila, tasa de concertación).**
- Dónde: `backend/src/services/informesService.ts` + `services/pdfInformes.ts` (pdfkit), `routes/informeRoutes.ts` (`GET /api/informes` y `GET /api/informes/:periodo/pdf`); frontend en `PanelVendedor` (`informeService.ts`).

**RQNF13.1 — Generar informes mensuales cada 1° de mes con transacciones concluidas de ese mes.**
- Dónde: `jobs/informesMensuales.ts` (día 1° a las 00:05) que llama a `generarInformesMensuales(periodo)`.

**RQNF13.2 [KO6.1] — Tasa de concertación = ventas concluidas / filas iniciadas, en porcentaje.**
- Dónde: `informesService.ts` (cálculo de la tasa con base en las filas del período). Prueba: `scripts/probar-informes.ts` (26/26).

**RQNF13.2 (historial) — Agregar el informe del mes recién concluido al historial cada día 1°.**
- Dónde: modelo `InformeVendedor` (MongoDB); si el servidor estaba apagado, el job recupera el pendiente al arrancar.

**RQNF13.3 [KO7.1] — Consultar y descargar en PDF todo el historial de informes en cualquier momento.**
- Cómo: el panel del vendedor lista el historial y cada informe se descarga en PDF; el backend genera el PDF al vuelo con `pdfInformes.ts`.

**RQNF14.1 — Contador de antigüedad por reporte y eliminación a los 13 meses (día 1° del mes en que cumplan).**
- Dónde: `informesService.purgarReportesEInformesAntiguos` y `sancionService.purgarFaltasExpiradas`, ejecutados por `jobs/informesMensuales.ts`; las faltas/sanciones también prescriben a los 13 meses. Prueba: `probar-informes.ts`.

**RQF14 [KO8.1] — El administrador consulta informes globales: categoría más vendida y tasa de abandono de fila por categoría.**
- Dónde: sección **Informes globales** del BackOffice (`pages/Admin/InformesGlobales.tsx`), `GET /api/admin/informes` y su PDF; también disponible por MCP (`listar_informes_globales`).

**RQNF14 — Categoría más vendida = total de productos vendidos agrupados por categoría, cada 1° de mes.**
- Dónde: `informesService.ts` (informe global mensual, modelo `InformeGlobal`).

**RQNF14.2 — Desempate por las ventas del mes anterior; si vuelve a empatar, no se muestra.**
- Dónde: `informesService.ts` (criterio de desempate implementado; sin resultado si persiste el empate). Prueba: `probar-informes.ts`.

**RQNF14.2 [KO9.1] — Tasa de abandono por categoría = usuarios que salieron o no completaron el pago, cada 1° de mes.**
- Dónde: `informesService.ts` con base en `cola.motivoCierre` (`salio_voluntariamente`, `turno_vencido`, etc.).

## Módulo 3: Fila virtual y proceso de compra

**RQF15 — El cliente navega el catálogo y selecciona un elemento de interés.**
- Dónde: `frontend/Ichiba/src/pages/Inicio` (buscador y listado), `Promocionales` y `ProductoCompleto`; backend `GET /api/productos` y `GET /api/promocionales`.

**RQNF15 (mostrar) — Mostrar imagen principal, precio y nombre del artículo.**
- Dónde: `components/CartaProducto`, `CartaPromocional` y la ficha `ProductoCompleto`.

**RQNF15 (horario) — Fuera del bloque de atención, los productos siguen visibles pero se inhabilita entrar a la fila, mostrando la fecha y hora del próximo bloque.**
- Dónde: `backend/src/utils/validarHorario.ts` (`evaluarAtencionDelVendedor`, `obtenerTextoDeLaSiguienteApertura`), `colaController.entrarEnFila` (400 con `proximoBloque`), `GET /api/colas/producto/:productoId/estado`; frontend `ProductoCompleto` (aviso con el próximo bloque). Prueba: `scripts/probar-fila-apertura.ts` (30/30).

**RQF16 — Botón "Entrar en la fila" para registrar el lugar en un producto disponible.**
- Dónde: `POST /api/colas/entrar` (`colaController.ts`); botón en `ProductoCompleto`.

**RQNF12 (FIFO) — Gestionar el orden de atención con el método FIFO.**
- Dónde: `backend/src/services/filaService.ts` (posiciones por orden de llegada; al liberar un turno, avanza el siguiente). Prueba: `probar-fila-apertura.ts` y `probar-escrow.ts`.

**RQNF13 (3 filas) — Máximo tres filas simultáneas por cliente.**
- Dónde: `colaController.entrarEnFila` (cuenta las filas activas del comprador).

**RQNF14 (mensaje) — "Ya estás en 3 filas. Abandona una para continuar" e impedir la cuarta.**
- Dónde: mismo controlador (400 con ese mensaje) y aviso en `ProductoCompleto`.

**RQNF16 — Advertencia previa si el tiempo restante de atención del vendedor es menor al tiempo límite de pago.**
- Dónde: `colaController.estadoDeMiFila` calcula `avisoAtencion`/`puedeElegirEspera` con `validarHorario.ts`; `ProductoCompleto` muestra el aviso y las dos opciones al llegar al turno. Prueba: `probar-fila-apertura.ts`.

**RQF17 — Clic en el nombre del vendedor para ver su perfil, reputación, productos activos y horario de atención.**
- Dónde: `GET /api/usuarios/:id/publico` (`usuarioController.obtenerPerfilPublico`) y frontend `pages/PerfilDelVendedor`.

**RQNF15 (bloque) — Inhabilitar el acceso a la compra fuera del bloque activo, indicando fecha y hora del próximo bloque.**
- Dónde: misma lógica del RQNF15 (aviso de apertura en la ficha y bloqueo de `POST /api/colas/entrar`). Prueba: `probar-fila-apertura.ts`.

**RQF18 — El cliente decide esperar hasta la próxima apertura si el horario está por terminar.**
- Dónde: `PATCH /api/colas/:id/esperar-apertura` (`colaController.esperarProximaApertura`) y botones "Pagar ahora" / "Esperar a la próxima apertura" en `ProductoCompleto`.

**RQNF18 (guardar lugar) — Guardar el lugar del cliente en la fila.**
- Dónde: `filaService.pausarHastaLaApertura` deja la fila en `esperando_apertura` con el reloj pausado; `reactivarFilasEnEsperaDeApertura` (job `revisionPagos`, cada minuto) la reanuda al abrir el bloque y avisa por correo. Prueba: `probar-fila-apertura.ts`.

**RQF19 — Consultar la posición actual en la fila mientras espera.**
- Dónde: `GET /api/colas/producto/:productoId/estado` (`estadoDeMiFila`) y `GET /api/colas/mias`.

**RQNF18 (FIFO y posición) — Mantener el orden FIFO y mostrar la posición.**
- Dónde: `filaService.ts` (posición por orden) y la ficha/burbuja.

**RQNF17 — Retirar automáticamente al usuario de la fila al concluir la venta exitosamente.**
- Dónde: `filaService.ts` cierra la fila con motivo `venta_completada` al liberarse el escrow. Prueba: `probar-escrow.ts`.

**RQNF19 — Burbuja flotante dinámica que actualiza en tiempo real la posición.**
- Dónde: `frontend/Ichiba/src/components/ColaBubble` y `FilaActivaComprador` con el contexto `ColasProvider` (refresco periódico).

**RQF20 — Registrar correo para alertas de fila y de productos nuevos por categoría.**
- Dónde: `POST /api/notificaciones/suscribir` (`notificacionRoutes.ts`) y `POST /api/suscripciones` (`suscripcionRoutes.ts`); modelos `Suscripcion` y `SuscripcionCategoria`; el correo de fila se guarda en `cola.correo`.

**RQNF18 (guardar correo/categorías) — Guardar correo y selección de categorías.**
- Dónde: mismos modelos y campo `correo` de la cola.

**RQNF18 (2 por día) — Notificaciones de nuevas publicaciones con límite de dos veces al día (10:00 y 17:00).**
- Dónde: `jobs/notificacionesCategoria.ts` (cron `0 10,17 * * *`) + `enviarCorreoNovedadesCategoria`.

**RQNF18 (primero en fila) — Correo al comprador cuando es el primero de la fila.**
- Dónde: `filaService.ts` → `enviarCorreoTurnoDePago` ("Ya es tu turno de pagar en Ichiba").

**RQF21 — Pagar con el panel de PayPal al llegar el turno.**
- Dónde: `POST /api/pagos/crear-orden` (`pagoController.crearOrden`) genera la orden de PayPal (o entrega llave pública y monto para el formulario embebido de MercadoPago) y `ProductoCompleto`/`PagoExitoso` guían el flujo; el dinero queda autorizado en escrow (captura diferida).

**RQNF18 (redirigir a PayPal) — Redirigir al comprador a la pantalla de pago de PayPal.**
- Cómo: la orden devuelve el `linkAprobacion` oficial de PayPal y el navegador va a esa pantalla; al volver se captura y se registra la venta. Con MercadoPago (Checkout API) el comprador ya no sale de Ichiba: el Payment Brick embebido tokeniza la tarjeta y `POST /api/pagos/mercadopago/procesar` crea el cobro (OXXO/SPEI quedan pendientes con comprobante y el webhook los acredita). Prueba: `probar-escrow.ts` (con mocks de la pasarela).

**RQF22 — Registrar el comprobante con palabra clave, número de referencia y fotografía/captura.**
- Dónde: `POST /api/pagos/:ventaId/comprobante` (`pagoController.registrarComprobante`, `subirComprobante`) y formulario en `pages/PagoExitoso`.

**RQNF18 (moderación del comprobante) — Usar una API de moderación en la imagen del comprobante antes de mostrarla al vendedor.**
- Dónde: `visionService.moderarComprobante` llamada desde `pagoController.ts`; la imagen solo se sirve por endpoint autenticado (`GET /api/pagos/comprobante/:ventaId/imagen`).

**RQNF20 — Clave numérica de 4 dígitos única e irrepetible por sesión de pago en la misma fila.**
- Dónde: `escrowService.generarCodigo4Digitos` y `generarCodigoPagoUnico` (evita repetir códigos activos), guardada en `venta.codigoPago`; se envía con `enviarCorreoPalabraClaveCompra` y se muestra en `PagoExitoso`. Prueba: `probar-escrow.ts`.

**RQF23 — Reportar al vendedor si el comprobante es rechazado.**
- Dónde: `POST /api/reportes` (`reporteController.ts`) con categoría de comprobante falso; botón de reporte en `Chats`/`MisPedidos`.

**RQNF23.1 — Verificar el reporte y, si aplica, reflejarlo en la reputación; en su defecto, rechazarlo.**
- Dónde: bandeja **Reportes pendientes** (`adminController`/`backofficeService`): confirmar suma puntos/sanciones; rechazar revierte. Pruebas: `probar-puntos-cancelacion.ts` y `probar-sanciones.ts`.

**RQNF23.2 — Permitir que la fila siga tras un rechazo de pago.**
- Dónde: `escrowService.rechazarComprobante` des-pausa la fila (estado `activa` de nuevo) para que el comprador reenvíe o el turno continúe. Prueba: `probar-escrow.ts`.

**RQF24 — Chat interno para coordinar la entrega tras confirmar el pago.**
- Dónde: `routes/mensajeRoutes.ts`, `controllers/mensajeController.ts`, modelo `Mensaje.ts`; frontend `pages/Chats`.

**RQNF24.1 — Advertir al pagar o enviar comprobante que la atención será solo dentro del bloque vigente del vendedor.**
- Dónde: aviso de atención en `ProductoCompleto`/`PagoExitoso` (calculado con `validarHorario.ts`) y recordatorio en el correo al vendedor (`enviarCorreoComprobanteRecibidoVendedor`). Prueba: `probar-fila-apertura.ts`.

**RQNF31 — Cancelar la transacción y reembolsar automáticamente si hay inactividad prolongada en el chat.**
- Dónde: `jobs/revisionEntregas.ts` (3 bloques de atención del vendedor sin mensajes, con `limiteDeInactividadDeChat` de `escrowService.ts`) → `cancelarEscrow` con reembolso. Prueba: `probar-escrow.ts`.

**RQNF24.2 (bloquear chat) — Bloquear el chat desde el envío del comprobante hasta que el vendedor lo compruebe.**
- Dónde: `mensajeController.ts` valida el estado de la venta (solo se puede escribir en `en_entrega` o `completada`); el chat aparece bloqueado en `Chats`. Prueba: `probar-escrow.ts`.

**RQNF27 — Liberar los fondos retenidos hacia la cuenta de PayPal del vendedor al registrarse el código de entrega.**
- Dónde: `escrowService.registrarEntrega` (captura la autorización y guarda `capturaPaypalId`) llamado desde `POST /api/pagos/:ventaId/confirmar-entrega`. Prueba: `probar-escrow.ts`.

**RQNF24.4 — Poner la fila en reposo al registrar el comprobante y dar un código de confirmación de entrega al comprador.**
- Dónde: al subir el comprobante la fila se pausa; al confirmarlo el vendedor, `escrowService` genera `codigoEntrega` y lo envía con `enviarCorreoCodigoEntregaComprador`. Prueba: `probar-escrow.ts`.

**RQF25 — Reportes de clientes a los administradores (estafas, fotos inapropiadas, palabras malsonantes o discriminación).**
- Dónde: `POST /api/reportes` y `POST /api/reportes/comprador`; bandeja **Reportes pendientes** del BackOffice.

**RQNF25.1 — Procesar de forma automática los reportes definidos; los de carácter distinto se revisan manualmente.**
- Cómo: cada categoría definida trae su tipo de falta y puntos calculados (el sistema tipifica la falta automáticamente); los reportes "otro motivo" se guardan y quedan en revisión manual del administrador, que confirma o rechaza. Prueba: `probar-puntos-cancelacion.ts`.

**RQF26 — El comprador otorga el código de confirmación de entrega al vendedor para finalizar.**
- Dónde: el comprador ve su `codigoEntrega` en `MisPedidos` y el vendedor lo captura en `PanelVendedor` (`POST /api/pagos/:ventaId/confirmar-entrega`).

**RQNF26 (liberar) — Liberar el dinero tras la confirmación del código.**
- Dónde: `escrowService.registrarEntrega` (captura de fondos + estado `completada`). Prueba: `probar-escrow.ts`.

**RQNF24 (cancelar por bloque) — Cancelar la compra, reembolsar e informar fecha y hora si el vendedor no confirma el comprobante antes de que termine su siguiente bloque.**
- Dónde: `jobs/revisionEntregas.ts` con `confirmacionLimite` calculado por `escrowService` (fin del siguiente bloque de atención) → `cancelarEscrow` con motivo, reembolso y correo (`enviarCorreoVentaCancelada` incluye el motivo). Prueba: `probar-escrow.ts`.

**RQNF26 (deshabilitar chat) — Deshabilitar el chat inmediatamente tras el código de entrega o la cancelación.**
- Dónde: `mensajeController.ts` solo permite escribir en ventas `en_entrega`; al pasar a `completada`/`reembolsada`/`cancelada` el chat queda bloqueado. Prueba: `probar-escrow.ts`.

**RQF27 — Calificar al vendedor con 1 a 5 estrellas tras confirmar la entrega.**
- Dónde: `POST /api/pagos/:ventaId/calificar` (`pagoController.calificar`) y la calificación en `pages/Chats`; el promedio lo calcula `reputacionService.ts`.

**RQNF24.2 (menú de calificación) — Mostrar un menú opcional de 1 a 5 estrellas.**
- Cómo: la calificación aparece como opción tras la entrega y es opcional; queda guardada en la venta (`calificacionComprador`).

**RQF28 — Abandonar voluntariamente la fila en cualquier momento.**
- Dónde: `PATCH /api/colas/:id/salir` (`colaController.salirDeFila`) y botón en `ColaBubble`/`ProductoCompleto`.

**RQNF23 (turno) — Retirar el turno, sacar al usuario y asignar automáticamente al siguiente si rechazan el comprobante o no paga a tiempo.**
- Dónde: `filaService.expirarFilasVencidas` (job `revisionPagos` cada minuto) reasigna el turno; `escrowService.rechazarComprobante` des-pausa la fila. Prueba: `probar-escrow.ts`.

**RQF29 — Preguntas en los comentarios públicos de un promocional o chat personalizado si el vendedor lo permite.**
- Dónde: `comentarioController.ts` (comentarios) y `mensajeController.ts`/modelo `Promocional.ts` (opción de chat habilitado).

**RQNF24.2 (comentarios visibles) — Mostrar los comentarios disponibles para todos.**
- Dónde: `GET /api/promocionales/:id/comentarios` y la zona de comentarios de `PromocionalDetalle`.

**RQNF24.2 (todos comentan) — Permitir que todos los usuarios comenten.**
- Dónde: `POST /api/promocionales/:id/comentarios` con `x-comprador-id` (no exige cuenta).

**RQNF24.2 (chat solo si el vendedor permite) — Permitir el chat solo con autorización del vendedor.**
- Dónde: el promocional guarda la opción de chat/comentarios y el backend la respeta.

**RQF30 — El vendedor revisa la referencia y la imagen del comprobante en el chat.**
- Dónde: `Chats`/`PanelVendedor` muestran el comprobante (imagen por `GET /api/pagos/comprobante/:ventaId/imagen`, solo participantes).

**RQNF24.2 (desbloquear) — Desbloquear el chat si el comprobante es confirmado.**
- Dónde: `escrowService.confirmarComprobante` pasa la venta a `en_entrega` y habilita los mensajes. Prueba: `probar-escrow.ts`.

**RQNF24.2 (des-pausar) — Des-pausar la fila si el comprobante es rechazado.**
- Dónde: `escrowService.rechazarComprobante` (fila vuelve a `activa` con nuevo tiempo de pago). Prueba: `probar-escrow.ts`.

**RQF31 — El vendedor confirma o rechaza el comprobante recibido.**
- Dónde: `POST /api/pagos/:ventaId/confirmar-comprobante` y `/rechazar-comprobante`; botones en `Chats`.

**RQNF28 — Revertir fondos y reembolsar si el vendedor no entrega dentro del tiempo estipulado.**
- Dónde: `jobs/revisionEntregas.ts` (plazo de 15 días `entregaLimite`) → `cancelarEscrow` con reembolso. Prueba: `probar-escrow.ts`.

**RQNF24.2 (permitir rechazar/confirmar) — Permitir al vendedor rechazar o confirmar el comprobante.**
- Cómo: ambas acciones están disponibles para las partes de la venta y actualizan el estado del escrow.

**RQF32 — El vendedor consulta el estado de la fila con el número de personas en espera.**
- Dónde: `GET /api/colas/mias` y las tarjetas de fila del `PanelVendedor`.

**RQNF24.2 (panel de filas) — Mostrar el estado de las filas desde el panel del vendedor.**
- Dónde: `PanelVendedor.tsx` (conteo y detalle de filas por producto).

**RQNF24.2 (solo activos) — Mostrar solo las filas de productos activos.**
- Dónde: el panel filtra por productos activos; las filas de productos archivados se cierran (`motivoCierre: producto_eliminado`).

**RQF33 — El vendedor registra el código de confirmación de entrega el día de la entrega.**
- Dónde: campo del código en `PanelVendedor` y `POST /api/pagos/:ventaId/confirmar-entrega`.

**RQNF24.2 (validar código) — Validar el código para desbloquear el dinero de la venta.**
- Dónde: `escrowService.registrarEntrega` compara el código capturado con `codigoEntrega`; solo si coincide captura los fondos (si no, 400). Prueba: `probar-escrow.ts`.

## Módulo 4: Chat de coordinación de entrega

**RQF35 — Comprador y vendedor envían mensajes de texto para acordar lugar, fecha, hora y método de entrega.**
- Dónde: `mensajeRoutes.ts`/`mensajeController.ts` (rutas separadas de comprador y vendedor) y `pages/Chats`.

**RQNF29 — Habilitar el chat exclusivamente cuando el pago esté confirmado y asociado el código de la transacción.**
- Dónde: `mensajeController.ts` valida que la venta esté `en_entrega`/`completada` (comprobante confirmado y código de entrega generado). Prueba: `probar-escrow.ts`.

**RQNF30 — Registrar de forma permanente todos los mensajes como evidencia auditable.**
- Dónde: modelo `Mensaje.ts` (MongoDB) con historial por venta; el administrador puede leerlo en **Trazabilidad** y por MCP (`auditar_chat_venta`). Prueba: `probar-mcp.ts`.

## Módulo 5: Gestión de usuarios y control administrativo

**RQF36 — El administrador consulta usuarios, verifica su información, suspende, reactiva y monitorea su historial.**
- Dónde: `adminRoutes.ts` (`GET /usuarios`, `PATCH /usuarios/:id/suspender`, `/reactivar`, `GET /historial`) con `backofficeService.ts`; frontend `GestionUsuarios.tsx` y `Trazabilidad.tsx`. Prueba: `probar-mcp.ts` (mismas herramientas) y `probar-sanciones.ts`.

**RQNF32 — Retener de forma preventiva el pago en escrow ante reportes, disputas activas o evidencias de irregularidades antes de la entrega.**
- Dónde: `venta.retenido` y `escrowService` (no libera ni reembolsa solo mientras haya irregularidades), `disputaService.ts`; el administrador resuelve en **Disputas y retenciones**. Prueba: `scripts/probar-disputas.ts` (65/65).

**RQF37 — El administrador revisa denuncias y reportes (fraude, publicaciones engañosas, lenguaje ofensivo, spam, discriminación o incumplimiento).**
- Dónde: bandeja **Reportes pendientes** (`RevisionReportes.tsx` + `backofficeService`), con confirmación o rechazo.

**RQNF33 — Aplicar bloqueos temporales automáticos según el tipo de infracción y reincidencia, con desbloqueo automático al concluir el periodo.**
- Dónde: `sancionService.ts` (3 leves → 7 días; 1 grave → 30 días) y `jobs/revisionSanciones.ts` (cada 5 minutos avisa el fin del bloqueo; el estado se calcula por fecha y se levanta solo). Prueba: `scripts/probar-sanciones.ts` (30/30).

**RQF38 — El administrador consulta el historial de filas, pagos, comprobantes, tiempos de respuesta y transacciones.**
- Dónde: `GET /api/admin/historial` (`obtenerHistorialTransacciones`) y la sección **Trazabilidad**; el comprobante y los tiempos se ven en el detalle de cada venta.

**RQNF34 — Incrementar progresivamente la duración de las sanciones hasta aplicar suspensión prolongada o indefinida.**
- Dónde: `sancionService.ts` (progresión 7 días → 30 días → indefinida según faltas acumuladas). Prueba: `probar-sanciones.ts`.

**RQF39 — El administrador audita el historial completo de mensajes del chat en caso de conflicto.**
- Dónde: `GET /api/admin/ventas/:ventaId/mensajes`, `ModalConversacion.tsx` y la herramienta MCP `auditar_chat_venta`.

**RQNF35 — Suspender indefinidamente y enviar a revisión administrativa las faltas graves (fraude comprobado, suplantación, amenazas o comprobantes falsos).**
- Dónde: `sancionService.ts` (esas causas → bloqueo indefinido + `revisionAdministrativa: true`, visibles en el BackOffice por la suscripción `usuariosAdmin`). Prueba: `probar-sanciones.ts`.

**RQF40 — El administrador dictamina disputas de reembolso evaluando evidencias de ambas partes (comprobantes, fotografías, capturas de conversaciones).**
- Dónde: `disputaService.ts`, sección **Disputas y retenciones** (`Disputas.tsx`), `GET/POST /api/admin/disputas*`; el comprador abre desde *Mis pedidos* y el vendedor responde con evidencias (fotos/capturas); el administrador dictamina reembolsar o rechazar. Por MCP: `listar_disputas` y `resolver_disputa`. Prueba: `probar-disputas.ts`.

**RQNF36 — Denegar nuevos registros de personas en la lista negra validando INE o RFC.**
- Dónde: `listaNegraService.ts` consultado por el registro (misma regla que RQNF1.9). Prueba: `probar-puntos-cancelacion.ts`.

**RQNF37 — Suspender al vendedor y reflejar saldo pendiente si la plataforma cubre un reembolso por su culpa directa (incumplimiento de entrega o descripción errónea).**
- Dónde: `adeudoService.ts` (registra el adeudo, suspende con `motivoSuspension: "saldo_pendiente"` y envía `enviarCorreoAdeudoRegistrado`), sección **Adeudos de vendedores**; también por MCP (`listar_adeudos`). Prueba: `probar-disputas.ts`.

**RQNF38 — Condicionar la reactivación de una cuenta con saldo pendiente a la liquidación total del adeudo.**
- Dónde: `adeudoService.liquidarAdeudo` (el administrador registra la transferencia; al llegar el saldo a cero se levanta la suspensión y se envía `enviarCorreoAdeudoLiquidado`); `POST /api/admin/adeudos/:id/liquidar` y MCP `liquidar_adeudo`. Prueba: `probar-disputas.ts`.

---

**Resumen de verificación.** Las 8 suites (escrow 64, puntos/cancelación 48, informes 26, suscripciones 11, MCP 22, sanciones 30, disputas 65 y fila/apertura 30 = **296 pruebas**), más la de comisión/PayPal (7), se ejecutan desde `backend/`; las 8 suites y la de comisión también corren en GitHub Actions. La de moderación (48) se ejecuta localmente porque levanta dos backends. `npx tsc --noEmit` pasa en backend y frontend. Los únicos pasos que dependen de una persona están listados en `DOCUMENTACION.md`, sección 8 (Pendientes manuales): prueba de pago con cuenta sandbox real, limpieza del historial de git y mantener activa la suscripción de Railway. (Los secretos de CI/CD ya no son necesarios: Railway y Vercel se auto-despliegan por integración directa con GitHub, verificado el 16/10/2026.)

---

# ANEXO II — Requisitos reformulados, verificación y estado de aprobación

> **Naturaleza de este anexo.** Se agrega al final del archivo y **no elimina ni sustituye** el texto anterior. El texto original queda como historial; este anexo es la versión que debe usarse para interpretar, evaluar y completar el proyecto.
>
> **Regla de prevalencia.** Si el texto original y este anexo se contradicen, prevalece este anexo. Si un requisito original no aparece aquí, se considera absorbido por el requisito nuevo que lo cita entre paréntesis.
>
> **Fecha de revisión:** 24/10/2026; actualización de trazabilidad y rol: 03/11/2026.
>
> **Control de versiones.** `requisitos.md` no está rastreado por Git, por lo que no existe una versión anterior contra la cual hacer un diff. La revisión se hizo contra el contenido actual del archivo y contra el código del proyecto.

## 1. Dictamen de la revisión

### 1.1. Lo que sí está bien

- El documento cubre los cinco módulos originales y añade la trazabilidad de implementación.
- La mayoría de los requisitos de los módulos 1 a 3 están implementados y tienen pruebas automatizadas.
- El proyecto ya cuenta con Full BackOffice, suscripciones GraphQL, servidor MCP, cinco APIs externas y CI/CD, aunque esos temas no estaban formalizados como requisitos con ID.
- Las suites reportadas suman **351 pruebas** (296 de las 8 suites E2E + 7 de comisión/PayPal + 48 de moderación), y `npx tsc --noEmit` pasa en backend y frontend.

### 1.2. IDs duplicados

Estos IDs aparecen más de una vez con contenidos distintos u opuestos:

- `RQNF1.1`: campos obligatorios y mensaje de registro denegado.
- `RQF6`: actualización de horario, restricción por no confirmar y login.
- `RQNF6`: actualización, restricción y autenticación.
- `RQNF7.3`: precio, moderación con Cloud Vision y filtro de palabras.
- `RQNF7.4`: descripción y tiempo límite de pago.
- `RQNF7.5`: condición del producto y guardado de todos los campos.
- `RQF10`: reportes del vendedor y aviso al comprador retirado.
- `RQNF10.1`, `RQNF10.2` y `RQNF10.3`: reputación, acceso de cuenta cancelada, reembolso y aviso al comprador.
- `RQF11`: correo de cancelación y edición de publicación.
- `RQNF11.1`: bloqueo de edición, aviso y bloqueo de baja.
- `RQNF12`: reputación del vendedor y orden FIFO.
- `RQNF13`: tasa de concertación y límite de tres filas.
- `RQNF13.2`: tasa de concertación e historial de informes.
- `RQNF16.8`: deshabilitar “Entrar en la fila” y calcular el siguiente bloque.
- `RQNF24.2`: bloqueo del chat, comentarios, desbloqueo, pausa de fila, confirmación del vendedor y panel de filas.
- `RQNF31`: inactividad del chat y numeración fuera de orden.

### 1.3. Referencias rotas o inexistentes

- `RQNF8.2` y `RQNF10.2` remiten a `RQNF7.7`, que no existe.
- `RQNF19.1` remite a `RQNF16.1`, que no existe.
- `RQNF10.2` remite a `RQF24` para el plazo de entrega, pero `RQF24` trata del chat.
- No existe `RQF34`; se salta de `RQF33` a `RQF35`.
- `QNF18.3` aparece sin la `R` inicial.
- `RQF7.1-RQF7.6` se cita como si fueran subrequisitos, pero varios no existen con esa numeración.
- El bloque de requisitos no revisados mezcla numeración funcional y no funcional, y reutiliza IDs ya usados antes.

### 1.4. Anotaciones editoriales pendientes

El archivo contiene notas que nunca se resolvieron:

- Línea 257: “Este no va aquí”.
- Línea 267: “Este no va aquí”.
- Línea 275: “Checar donde va este qwey”.
- Línea 330: “Primero poner lo que ve el usuario y después lo que hace el sistema”.
- Línea 338: “Se modifica es ambiguo la última parte”.
- Línea 370: “Validar el que estamos validamos, en este apartado, revisar que sea el ticket”.
- Línea 380: advierte que los requisitos siguientes no fueron revisados por quien autoriza el proyecto.

### 1.5. Contradicciones entre el requisito y la implementación

1. **Código de entrega.** `RQNF24.4` dice que el código se otorga al **registrar el comprobante**. En el código, el código se genera cuando el **vendedor confirma el comprobante** (`confirmarComprobanteDeVenta`, en `escrowService.ts`).  
   **Corrección:** el comprobante pausa la fila; el código nace con la confirmación del vendedor.

2. **Chat y horario.** `RQNF18.4` dice que, al elegir “Pagar ahora”, el chat queda bloqueado hasta el siguiente bloque de atención. En el código, el chat se habilita cuando el vendedor confirma el comprobante (`estado: en_entrega`), sin esperar al siguiente bloque; el horario solo se muestra como aviso.  
   **Corrección:** el chat se bloquea hasta la confirmación del comprobante; la atención se presta dentro del horario, pero el sistema no retrasa artificialmente el chat.

3. **Pasarela de pago.** `RQF21` y `RQNF18` hablan solo de PayPal. El código y la interfaz ya aceptan **PayPal y Mercado Pago**.  
   **Corrección:** el pago se realiza con la pasarela que el vendedor tenga configurada; PayPal y Mercado Pago son opciones válidas.

4. **Condiciones del producto.** `RQF7` pide una condición entre cuatro valores y una sola fotografía. La interfaz actual muestra **una sola selección de “Condiciones de uso”**, aunque el backend conserva `condicion` y `condicionUso` por compatibilidad, y permite **varias imágenes**.  
   **Corrección:** una sola selección visible, con las cuatro opciones, y una o más imágenes.

5. **Notificaciones críticas.** `RQF2` las presenta como una casilla que el usuario “selecciona”; `RQNF2.1` prohíbe registrarse si no las acepta. El código las exige obligatoriamente y solo deja opcionales las publicitarias y las de comentarios.  
   **Corrección:** no es una casilla opcional; es una aceptación obligatoria e informada.

6. **Token y Merchant ID.** `RQNF4` dice “Token de Acceso cifrado (Merchant ID)”, mezclando dos cosas distintas. El código cifra el `access_token` y el `refresh_token` con AES-256-GCM y guarda el `payer_id` como Merchant ID.  
   **Corrección:** se guardan por separado el token cifrado y el Merchant ID.

7. **Tiempo real de la burbuja.** `RQF19` dice “se actualiza en tiempo real”. La implementación refresca cada **5 segundos** con `setInterval`, sin recargar la página.  
   **Corrección:** actualización automática periódica de hasta 5 segundos; no es WebSocket.

8. **Referencia del comprobante.** `RQF22` pide “número de referencia”, pero el sistema solo valida que el campo exista y que la palabra clave coincida; **no comprueba que la referencia aparezca en la imagen**. La nota de la línea 370 pide revisar “que sea el ticket”.  
   **Corrección:** se separa la validación de presencia de la validación contra la imagen; la segunda queda como decisión pendiente.

9. **Atención y chat.** `RQNF24.1` dice que la atención será únicamente dentro del horario del vendedor. El chat permite escribir a cualquier hora y solo muestra el aviso; no bloquea por horario.  
   **Corrección:** el horario es una advertencia de disponibilidad, no un candado técnico del chat.

10. **Cinco APIs externas.** El anexo original dice “6 APIs” e incluye el panel de PayPal. El panel es una interfaz, no una API. Las APIs integradas son cinco: PayPal, Mercado Pago, StructOCR, Gmail SMTP y Google Cloud Vision.  
    **Corrección:** se cuentan cinco APIs; el panel de PayPal se menciona aparte.

### 1.6. Requisitos no aprobados

El bloque que empieza en la línea 380 está marcado expresamente como **no revisado por quien autoriza el proyecto**. Eso incluye, como mínimo:

- `RQF23` a `RQF33`.
- `RQNF23.1` a `RQNF38`.
- Los requisitos de chat, escrow, entrega, calificación, comentarios, panel del vendedor y administración que dependen de ese bloque.

**Regla:** estos requisitos pueden estar implementados, pero **no deben presentarse como aprobados** hasta que el usuario los valide. En este anexo se marcan como `[Propuesto]`.

> **Actualización 24/10/2026:** el cliente delegó expresamente la revisión de este bloque y lo aprobó. Por eso los requisitos de chat/entrega/calificación y administración pasan a `[Aprobado]`; se conserva esta sección como historial de que el documento original no los tenía revisados.

### 1.7. Bloqueos externos que impiden declarar el 100 %

- **Google Cloud Vision:** **resuelto.** La facturación está activada en el mismo proyecto y con la misma API key. `LABEL_DETECTION` y `SAFE_SEARCH_DETECTION` responden HTTP 200; la moderación sigue fallando cerrada si Vision no responde.
- **PayPal OAuth en producción:** el código ya envía el `redirect_uri` correcto y solicita `email`; falta configurar la app live, registrar el callback, definir `PAYPAL_API_BASE` live y probar con una cuenta real.
- **Comisión real con PayPal:** el código envía `platform_fees` al capturar la autorización; PayPal exige enrolamiento en **Complete Payments Platform** y vendedores enrolados. `PAYPAL_PLATFORM_MERCHANT_ID` es opcional: si falta, la comisión se acredita a la cuenta dueña de la app. Sin el enrolamiento, el modo `registro` solo informa la comisión, no la cobra.
- **Railway:** no hay volumen persistente para `/app/uploads`; las imágenes pueden perderse en un redeploy.
- **P0 de seguridad:** falta rotar `JWT_SECRET` y suspender las cuentas demo de producción.

### 1.8. Conclusión del dictamen

El documento original es útil como historial, pero **no es apto para evaluación formal** por los IDs repetidos, las referencias rotas y la mezcla de requisitos aprobados con propuestos. La versión reformulada de este anexo conserva la intención de todos los requisitos, elimina ambigüedades y separa claramente lo aprobado de lo pendiente.

## 2. Convenciones de esta reformulación

### 2.1. Identificadores

Para evitar otra vez IDs repetidos, se usa un identificador único por dominio:

- `RF-GEN`: requisito funcional general.
- `RNF-GEN`: requisito no funcional general.
- `RF-AUT` / `RNF-AUT`: registro, autenticación y horarios.
- `RF-CAT` / `RNF-CAT`: catálogo del vendedor.
- `RF-REP` / `RNF-REP`: reportes, reputación y sanciones.
- `RF-FIL` / `RNF-FIL`: fila virtual y catálogo del comprador.
- `RF-PAG` / `RNF-PAG`: pagos, comprobantes y escrow.
- `RF-CHA` / `RNF-CHA`: chat, entrega y calificación.
- `RF-ADM` / `RNF-ADM`: administración y BackOffice.

Entre paréntesis se conserva el **ID original** para que el código, las pruebas y el anexo de trazabilidad sigan siendo localizables.

### 2.2. Estados

- `[Aprobado]`: el usuario lo aprobó de forma explícita o está en la introducción del documento.
- `[Implementado]`: existe en código y tiene evidencia de funcionamiento o pruebas.
- `[Parcial]`: existe, pero depende de configuración externa o no cubre todo el requisito.
- `[Propuesto]`: reformulado, pero **no aprobado**; no debe evaluarse como requisito cerrado.
- `[Bloqueado]`: no puede completarse sin una acción externa.

Un requisito puede ser `[Implementado]` y a la vez `[Propuesto]`. Eso significa que el código ya lo hace, pero el usuario todavía no lo ha aprobado como requisito.

### 2.3. Reglas de redacción

- “Debe” indica obligación; “puede” indica opción.
- Los plazos se expresan en la zona centro de México (GMT-6).
- Los montos se expresan en pesos mexicanos (MXN).
- Las referencias a “el usuario” se concretan como comprador, vendedor o administrador.
- Los requisitos de seguridad se aplican a todos los roles.

## 3. Requisitos generales de plataforma

### 3.1. Full BackOffice y datos en vivo

- **RF-GEN-01** `[Aprobado · Implementado]` — El sistema debe ofrecer un Full BackOffice con nueve secciones: Inicio, Gestión de usuarios, Reportes pendientes, Disputas y retenciones, Adeudos, Informes globales, Lista negra, Solicitudes de registro y Trazabilidad. *(Origen: introducción del documento.)*
- **RF-GEN-02** `[Aprobado · Implementado]` — El BackOffice debe actualizarse en vivo mediante suscripciones GraphQL por WebSocket en cinco canales: `resumenAdmin`, `reportesPendientes`, `usuariosAdmin`, `listaNegraActualizada`, `solicitudesRegistro` y `disputasActualizadas`. *(Origen: introducción.)*
- **RF-GEN-03** `[Aprobado · Implementado]` — El sistema debe exponer un servidor MCP con 18 herramientas de BackOffice, disponible por `stdio` y por HTTP en `/mcp`, restringido a administradores. *(Origen: introducción.)*

### 3.2. APIs externas, stack y CI/CD

- **RF-GEN-04** `[Aprobado · Parcial]` — El sistema debe integrar al menos cinco APIs externas: PayPal Checkout v2, Mercado Pago Checkout API, StructOCR, Gmail SMTP y Google Cloud Vision. El panel de PayPal no cuenta como API. *(Origen: introducción.)*
  - **Parcial:** las cinco están integradas y Google Vision ya responde con facturación activa (`LABEL_DETECTION` y `SafeSearch`, HTTP 200). PayPal OAuth quedó corregido en código, pero falta configurar la app live, el callback y el enrolamiento de comisiones en PayPal Complete Payments.
- **RNF-GEN-01** `[Aprobado · Implementado]` — El sistema debe usar Astro para el portal, React para la aplicación interactiva, PostgreSQL como base relacional, MongoDB como base no relacional, GraphQL para la API y MCP para las herramientas de BackOffice. *(Origen: introducción.)*
- **RNF-GEN-02** `[Aprobado · Implementado]` — El proyecto debe contar con integración y despliegue continuos mediante GitHub Actions, ejecutando las suites de prueba y compilando ambos frontends. *(Origen: introducción.)*
- **RNF-GEN-03** `[Aprobado · Parcial]` — El sistema debe proteger el acceso con JWT, hash de contraseñas con bcrypt, control de roles, secretos fuera del repositorio y claves de API restringidas. *(Origen: introducción y políticas de seguridad.)*
  - **Parcial:** falta rotar `JWT_SECRET` y suspender las cuentas demo de producción.
  - **Actualización 03/11/2026:** el login y el middleware de `/admin` ya leen el rol vigente de PostgreSQL; el espejo de MongoDB se sincroniza al iniciar sesión para que la interfaz y la autorización no se contradigan. Sigue pendiente el cierre de seguridad de producción.

### 3.3. Calidad, privacidad y comportamiento ante fallos

- **RNF-GEN-04** `[Aprobado · Implementado]` — La interfaz debe ser responsive y funcionar sin recortes ni scroll horizontal en escritorio y móvil. *(Origen: correcciones de UX solicitadas.)*
- **RNF-GEN-05** `[Aprobado · Implementado]` — Si un servicio crítico de moderación no está disponible, el sistema debe **fallar cerrado**: bloquear la publicación o el comprobante en lugar de permitir contenido sin revisar. *(Origen: RQNF7.3 y RQNF22.4.)*
- **RNF-GEN-06** `[Aprobado · Implementado]` — El sistema debe publicar una política de privacidad que explique datos recopilados, datos sensibles, pagos, comisiones, IVA, conservación, seguridad y derechos ARCO. *(Origen: correcciones de privacidad solicitadas.)*
- **RNF-GEN-07** `[Aprobado · Implementado]` — El sistema debe registrar eventos relevantes de seguridad, pagos, sanciones y administración para permitir auditoría y diagnóstico. *(Origen: RQF38/RQF39 y BackOffice.)*
- **RNF-GEN-08** `[Aprobado · Implementado]` — Ningún secreto, token, contraseña o archivo `.env` debe commitearse al repositorio. *(Origen: política de seguridad del proyecto.)*

## 4. Módulo 1 — Registro, autenticación y horarios

### 4.1. Registro del vendedor

- **RF-AUT-01** `[Aprobado · Implementado]` — El vendedor debe registrarse con nombre completo, domicilio, teléfono, correo electrónico, RFC, frente y reverso de su INE, contraseña, método de pago y dato para recibirlo. *(Origen: RQF1.)*
- **RNF-AUT-01** `[Aprobado · Implementado]` — El sistema debe validar que todos los campos obligatorios estén completos antes de enviar el registro. *(Origen: RQNF1.1.)*
- **RNF-AUT-02** `[Aprobado · Implementado]` — El teléfono debe tener exactamente 10 dígitos numéricos. *(Origen: RQNF1.2.)*
- **RNF-AUT-03** `[Aprobado · Implementado]` — El sistema debe enviar un código numérico aleatorio de 4 dígitos al correo electrónico para confirmar la cuenta. *(Origen: RQNF1.3.)*
- **RNF-AUT-04** `[Aprobado · Implementado]` — El RFC debe coincidir con los primeros 10 caracteres de la CURP extraída de la INE. *(Origen: RQNF1.4.)*
- **RNF-AUT-05** `[Aprobado · Implementado]` — El nombre completo debe coincidir con los datos extraídos de la INE. *(Origen: RQNF1.5.)*
- **RNF-AUT-06** `[Aprobado · Implementado]` — Las imágenes de la INE deben ser `.png`, `.jpeg` o `.jpg` y medir al menos 420 × 540 píxeles. *(Origen: RQNF1.6.)*
- **RNF-AUT-07** `[Aprobado · Implementado]` — La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número y un símbolo de `! @ # $ % & * - _`. *(Origen: RQNF1.7.)*
- **RNF-AUT-08** `[Aprobado · Implementado]` — El sistema debe extraer nombre y CURP de la INE mediante StructOCR. *(Origen: RQNF1.8.)*
- **RNF-AUT-09** `[Aprobado · Implementado]` — El sistema debe denegar el registro si el RFC, la CURP o el código de la INE coinciden con la lista negra. *(Origen: RQNF1.9.)*
- **RNF-AUT-10** `[Aprobado · Implementado]` — El mensaje de denegación debe ser inmediato y no revelar cuál dato coincidió con la lista negra. *(Origen: RQNF1.1 duplicado y RQF1.1.)*
- **RNF-AUT-31** `[Aprobado · Implementado]` — El registro también debe denegarse cuando sus datos de identificación o su teléfono ya pertenecen a una cuenta registrada. *(Origen: RQNF1.9.)*
- **RNF-AUT-32** `[Aprobado · Implementado]` — El mensaje de denegación debe indicar que los datos ingresados no pueden ser registros y que la persona puede comunicarse con los administradores. *(Origen: RQF1.1.)*
- **RNF-AUT-33** `[Aprobado · Implementado]` — La persona a la que se le denegó el alta debe poder solicitar a los administradores la revisión de su caso. *(Origen: RQNF1.9 y RQF1.1.)*

### 4.2. Notificaciones

- **RF-AUT-02** `[Aprobado · Implementado]` — El vendedor debe aceptar obligatoriamente las notificaciones críticas sobre su cuenta, la fila virtual y los pagos. *(Origen: RQF2 y RQNF2.2.)*
- **RNF-AUT-11** `[Aprobado · Implementado]` — El sistema no debe permitir el registro si el usuario no acepta las notificaciones críticas. *(Origen: RQNF2.1.)*
- **RNF-AUT-12** `[Aprobado · Implementado]` — El sistema debe guardar la aceptación de notificaciones críticas como verdadera. *(Origen: RQNF2.3.)*
- **RF-AUT-03** `[Aprobado · Implementado]` — El vendedor puede aceptar o rechazar las notificaciones sobre comentarios en publicaciones promocionales. *(Origen: RQF3.)*
- **RNF-AUT-13** `[Aprobado · Implementado]` — El sistema debe guardar la preferencia de notificaciones de comentarios sin afectar el registro. *(Origen: RQNF3.)*

### 4.3. Vinculación con PayPal

- **RF-AUT-04** `[Aprobado · Parcial]` — El sistema debe redirigir al vendedor a la pasarela oficial de PayPal mediante OAuth 2.0 para vincular su cuenta. *(Origen: RQF4.)*
  - **Parcial:** el flujo y el callback están implementados y probados con el simulador; falta la app live, el callback registrado y una prueba con una cuenta real.
- **RNF-AUT-14** `[Aprobado · Implementado]` — El flujo OAuth debe usar un `state` aleatorio de un solo uso para prevenir CSRF y debe consumirlo al recibir el callback. *(Origen: RQNF4.)*
- **RNF-AUT-15** `[Aprobado · Implementado]` — El `access_token` y el `refresh_token` deben guardarse cifrados con AES-256-GCM; nunca en texto plano ni en logs. *(Origen: RQNF4.)*
- **RNF-AUT-16** `[Aprobado · Implementado]` — El `payer_id` de PayPal debe guardarse por separado como Merchant ID y usarse para dirigir los fondos del vendedor. *(Origen: RQNF4.)*
- **RNF-AUT-17** `[Aprobado · Parcial]` — La vinculación debe funcionar en producción con credenciales live, `redirect_uri` registrada y callback accesible. *(Origen: RQNF4.)*
  - **Parcial:** el código ya envía el `redirect_uri` tanto a la URL de autorización como al intercambio del token, y solicita el permiso `email`. Falta configurar `PAYPAL_API_BASE` live, registrar el callback exacto y probar con una cuenta real; el flujo no puede declararse operativo hasta entonces.

### 4.4. Horarios de atención

- **RF-AUT-05** `[Aprobado · Implementado]` — El vendedor debe definir su disponibilidad por día, con rangos entre 05:00 y 23:59 horas de la zona centro (GMT-6). *(Origen: RQF5.)*
- **RNF-AUT-18** `[Aprobado · Implementado]` — El sistema debe guardar los horarios en formato de 24 horas. *(Origen: RQNF5.1.)*
- **RNF-AUT-19** `[Aprobado · Implementado]` — El vendedor debe registrar al menos una hora de atención por semana. *(Origen: RQNF5.2 y RQNF6.2 duplicado.)*
- **RNF-AUT-20** `[Aprobado · Implementado]` — El sistema debe solicitar la confirmación obligatoria del horario el día 1.º de cada mes. *(Origen: RQNF5.3.)*
- **RNF-AUT-21** `[Aprobado · Implementado]` — El sistema debe guardar la confirmación o, en su defecto, incrementar el contador de faltas. *(Origen: RQNF5.4.)*

### 4.5. Actualización, incumplimiento y eliminación de cuenta

- **RF-AUT-06** `[Aprobado · Implementado]` — El vendedor puede actualizar, confirmar o modificar sus horarios de atención. *(Origen: RQF6.)*
- **RNF-AUT-22** `[Aprobado · Implementado]` — El sistema debe aplicar los cambios de horario cuando el vendedor los guarde. *(Origen: RQNF6.1.)*
- **RNF-AUT-23** `[Aprobado · Implementado]` — El sistema debe enviar un aviso 15 días antes de la eliminación pronosticada de la cuenta. *(Origen: RQNF6.3.)*
- **RNF-AUT-24** `[Aprobado · Implementado]` — El sistema debe contar dos faltas consecutivas de confirmación y, al llegar a la segunda, enviar el aviso de eliminación. *(Origen: RQNF6.4.)*
- **RNF-AUT-25** `[Aprobado · Implementado]` — El sistema debe eliminar la cuenta el día 1.º del mes en que se acumulen dos faltas consecutivas. *(Origen: RQNF6.5.)*
- **RNF-AUT-26** `[Aprobado · Implementado]` — La eliminación debe borrar todos los registros relacionados con el vendedor, incluidos archivos, sin posibilidad de recuperación. *(Origen: RQNF6.6.)*
- **RNF-AUT-27** `[Aprobado · Implementado]` — Mientras el vendedor no confirme su horario, el sistema debe restringir la publicación y edición de catálogo, sin impedir el inicio de sesión ni la consulta de su cuenta. *(Origen: RQF6/RQNF6 duplicados.)*

### 4.6. Inicio de sesión

- **RF-AUT-07** `[Aprobado · Implementado]` — El usuario debe iniciar sesión con correo electrónico y contraseña. *(Origen: RQF6 duplicado.)*
- **RNF-AUT-28** `[Aprobado · Implementado]` — La autenticación debe consultar MongoDB y comparar la contraseña con su hash bcrypt; nunca con texto plano. *(Origen: RQNF6 duplicado.)*
- **RNF-AUT-29** `[Aprobado · Implementado]` — El sistema debe emitir un JWT con el identificador numérico del usuario y su rol vigente en PostgreSQL, y debe rechazar cuentas suspendidas o canceladas según corresponda. MongoDB se usa como espejo y se sincroniza si el rol quedó desfasado. *(Origen: RQNF6 duplicado y RQNF10.1; actualización del 03/11/2026.)*
- **RNF-AUT-30** `[Aprobado · Implementado]` — Una cuenta cancelada solo puede completar entregas cuyo pago ya estaba confirmado antes de la cancelación; no puede publicar, editar, recibir nuevas filas ni usar el resto de la plataforma. *(Origen: RQF12/RQNF10.1.)*

## 5. Módulo 2 — Catálogo del vendedor

### 5.1. Publicación de productos

- **RF-CAT-01** `[Aprobado · Implementado]` — El vendedor debe publicar un producto con nombre, precio, descripción, una sola selección de “Condiciones de uso”, una o más imágenes, categoría, método de entrega, rango horario para coordinar la entrega y tiempo límite de pago. *(Origen: RQF7.)*
- **RNF-CAT-01** `[Aprobado · Implementado]` — Todos los campos obligatorios deben estar completos antes de guardar. *(Origen: RQNF7.1.)*
- **RNF-CAT-02** `[Aprobado · Implementado]` — Las imágenes deben ser `.png`, `.jpeg` o `.jpg`, medir entre 420 × 540 y 2560 × 2560 píxeles y existir al menos una. *(Origen: RQNF7.2.)*
- **RNF-CAT-03** `[Aprobado · Implementado]` — El precio debe estar entre $10 y $5,000 MXN. Si vale más de $5,000, debe publicarse como promocional. *(Origen: RQNF7.3 duplicado.)*
- **RNF-CAT-04** `[Aprobado · Implementado]` — La descripción debe tener entre 30 y 100 caracteres, contando espacios. *(Origen: RQNF7.4.)*
- **RNF-CAT-05** `[Aprobado · Implementado]` — La condición debe ser una de cuatro opciones: nuevo, usado-como nuevo, usado-buen estado o usado aceptable. *(Origen: RQNF7.5.)*
- **RNF-CAT-06** `[Aprobado · Implementado]` — La categoría debe ser una de las predefinidas: Artesanías, Ropa (segunda mano), Hogar, Electrodomésticos, Coleccionables u Otros. *(Origen: RQF8.)*
- **RNF-CAT-07** `[Aprobado · Implementado]` — El método de entrega debe ser envío a domicilio, punto de encuentro o entrega en tienda, con un rango horario propuesto independiente del horario de atención. *(Origen: RQF7.)*
- **RNF-CAT-08** `[Aprobado · Implementado]` — El tiempo límite de pago debe estar entre 30 minutos y 3 horas; si no se envía, el valor por defecto es 1 hora. *(Origen: RQNF7.4.)*
- **RNF-CAT-09** `[Aprobado · Implementado]` — El sistema debe analizar cada fotografía nueva con Google Cloud Vision (`LABEL_DETECTION`) y bloquear carros, motos, casas, terrenos, mascotas, personas, armas, sustancias controladas o productos perecederos. *(Origen: RQNF7.3 duplicado.)*
  - **Implementado:** facturación de Google Cloud activada. Smoke test real con `LABEL_DETECTION`: HTTP 200 y etiqueta `Blue (99 %)`. La suite simulada de moderación pasó 48/48 y conserva el comportamiento de fallar cerrado.
- **RNF-CAT-10** `[Aprobado · Implementado]` — El sistema debe comparar todos los campos de texto contra una lista de palabras prohibidas y bloquear el guardado si hay coincidencia. *(Origen: RQNF7.3 duplicado.)*
- **RNF-CAT-11** `[Aprobado · Implementado]` — El sistema debe guardar todos los campos de la publicación. *(Origen: RQNF7.5 duplicado.)*
- **RNF-CAT-12** `[Aprobado · Implementado]` — La interfaz debe mostrar una sola selección de “Condiciones de uso”; el backend puede conservar `condicion` y `condicionUso` por compatibilidad, pero no debe pedir dos veces la misma condición. *(Origen: corrección de UX solicitada.)*

### 5.2. Alertas por contenido no permitido

- **RF-CAT-02** `[Aprobado · Implementado]` — El vendedor debe recibir una alerta cuando un campo de texto coincida con una palabra no permitida. *(Origen: RQF8 y RQNF8.)*
- **RNF-CAT-13** `[Aprobado · Implementado]` — La alerta debe mostrarse inmediatamente después de detectar la coincidencia. *(Origen: RQNF8.1.)*
- **RNF-CAT-14** `[Aprobado · Implementado]` — El vendedor debe poder corregir el contenido y reenviarlo; el sistema debe aplicar de nuevo todas las validaciones. *(Origen: RQNF8.2.)*

### 5.3. Categorías

- **RF-CAT-03** `[Aprobado · Implementado]` — El vendedor debe seleccionar obligatoriamente una categoría predefinida al publicar. *(Origen: RQF8.)*
- **RNF-CAT-15** `[Aprobado · Implementado]` — El sistema debe validar que exista una categoría seleccionada y guardarla. *(Origen: RQNF8.1 y RQNF8.2.)*

### 5.4. Publicaciones promocionales

- **RF-CAT-04** `[Aprobado · Implementado]` — El vendedor debe publicar un promocional con nombre, descripción, condición de uso, imágenes, precio, opción de chat/comentarios y cobertura de envío o zona. *(Origen: RQF9.)*
- **RNF-CAT-16** `[Aprobado · Implementado]` — El sistema debe validar que los campos obligatorios no estén vacíos. *(Origen: RQNF9.1.)*
- **RNF-CAT-17** `[Aprobado · Parcial]` — Las imágenes del promocional deben cumplir los mismos formatos y dimensiones que las de producto y pasar por Google Vision. *(Origen: RQNF9.2 y RQNF9.3.)*
  - **Parcial:** los formatos y dimensiones sí se validan igual que en el catálogo. La moderación de Vision **no se aplica a promocionales por diseño**, porque ese catálogo existe para autos, casas y terrenos que `LABEL_DETECTION` bloquearía. Si se quiere moderar promocionales, hace falta una lista de etiquetas permitidas distinta; queda como decisión de producto, no como fallo de configuración.
- **RNF-CAT-18** `[Aprobado · Implementado]` — El sistema debe filtrar palabras prohibidas en todos los campos de texto del promocional. *(Origen: RQNF9.4 y RQNF10.)*
- **RNF-CAT-19** `[Aprobado · Implementado]` — El precio del promocional debe ser mayor a $5,001 MXN, sin máximo. *(Origen: RQNF9.5.)*
- **RNF-CAT-20** `[Aprobado · Implementado]` — El vendedor puede habilitar o deshabilitar el chat o la zona de comentarios del promocional y debe indicar la cobertura de envío o zona. *(Origen: RQF9.)*
- **RNF-CAT-21** `[Aprobado · Implementado]` — El sistema debe guardar todos los campos del promocional. *(Origen: RQF9 y RQNF9.1–RQNF9.5.)*

### 5.5. Edición y baja de publicaciones

- **RF-CAT-05** `[Aprobado · Implementado]` — El vendedor puede modificar nombre, categoría, precio, descripción, condición, imágenes, método de entrega y rango horario de una publicación. *(Origen: RQF11.)*
- **RNF-CAT-22** `[Aprobado · Implementado]` — El sistema debe impedir la edición o baja de una publicación si existe una transacción activa o una fila en curso vinculada. *(Origen: RQNF11.1 y RQNF11.2.)*
- **RNF-CAT-23** `[Aprobado · Implementado]` — El vendedor debe ver un aviso cuando no pueda editar o dar de baja por existir una operación activa. *(Origen: RQNF11.1 duplicado.)*
- **RNF-CAT-24** `[Aprobado · Implementado]` — Al editar, el sistema debe volver a validar todos los campos con las mismas reglas de la publicación inicial. *(Origen: RQNF11.4.)*
- **RNF-CAT-25** `[Aprobado · Implementado]` — Al dar de baja, la publicación debe cambiar a inactiva, salir del catálogo y conservarse para historial e informes. *(Origen: RQNF11.5.)*

### 5.6. Panel e informes del vendedor

- **RF-CAT-06** `[Aprobado · Implementado]` — El vendedor debe consultar desde su panel el estado de sus productos (activo, inactivo, con fila o vendido) y su reputación. *(Origen: RQF12.)*
- **RNF-CAT-26** `[Aprobado · Implementado]` — La reputación del vendedor debe calcularse como el promedio de calificaciones enteras de 1 a 5 estrellas de los compradores. *(Origen: RQNF12.)*
- **RF-CAT-07** `[Aprobado · Implementado]` — El vendedor debe descargar en PDF sus informes de ventas con total por período, productos vendidos, tiempo promedio por fila y tasa de concertación. *(Origen: RQF13.)*
- **RNF-CAT-27** `[Aprobado · Implementado]` — El sistema debe generar informes mensuales el día 1.º de cada mes con las transacciones concluidas del mes. *(Origen: RQNF13.1.)*
- **RNF-CAT-28** `[Aprobado · Implementado]` — La tasa de concertación debe ser ventas concluidas entre filas iniciadas, expresada como porcentaje. *(Origen: RQNF13.2.)*
- **RNF-CAT-29** `[Aprobado · Implementado]` — El sistema debe agregar el informe del mes recién concluido al historial el día 1.º y recuperar el pendiente si el servidor estuvo apagado. *(Origen: RQNF13.2 duplicado.)*
- **RNF-CAT-30** `[Aprobado · Implementado]` — El vendedor debe poder consultar y descargar en PDF todo su historial de informes en cualquier momento. *(Origen: RQNF13.3.)*
- **RNF-CAT-31** `[Aprobado · Implementado]` — Cada reporte debe eliminarse a los 13 meses de su creación, el día 1.º del mes en que cumpla la antigüedad. *(Origen: RQNF14.1.)*

## 6. Módulo 3 — Reportes, reputación y sanciones

- **RF-REP-01** `[Aprobado · Implementado]` — El usuario puede reportar a otro usuario eligiendo motivo y agregando una descripción. *(Origen: RQF10 y RQF25.)*
- **RNF-REP-01** `[Aprobado · Implementado]` — Los motivos deben incluir comportamientos impropios, estafas, fotos inapropiadas, comprobantes falsos, palabras malsonantes o discriminación. *(Origen: RQF10 y RQF25.)*
- **RNF-REP-02** `[Aprobado · Implementado]` — El sistema debe asignar puntos según la gravedad: 3 puntos para faltas graves, 1.5 para faltas leves de trato directo y 1 para faltas leves. *(Origen: RQNF10.1.)*
- **RNF-REP-03** `[Aprobado · Implementado]` — Los puntos deben ser acumulativos y la cuenta debe cancelarse permanentemente al llegar a 8 puntos. *(Origen: RQNF10.3.)*
- **RNF-REP-04** `[Aprobado · Implementado]` — Los reportes con motivo “otro motivo” deben guardarse para revisión. *(Origen: RQNF10.4 y RQNF25.1.)*
- **RF-REP-02** `[Aprobado · Implementado]` — El vendedor debe recibir un correo cuando su cuenta sea cancelada por acumular 8 puntos. *(Origen: RQF11.)*
- **RNF-REP-05** `[Aprobado · Implementado]` — El correo debe indicar el motivo de la cancelación y los reportes que la originaron. *(Origen: RQNF10.5.)*
- **RNF-REP-06** `[Aprobado · Implementado]` — Al cancelar la cuenta, el sistema debe eliminar datos personales, publicaciones, chats y tokens, conservando RFC e INE en la lista negra. *(Origen: RQNF10.6.)*
- **RNF-REP-07** `[Aprobado · Implementado]` — El sistema debe cancelar las filas activas del vendedor cancelado en las que el comprador aún no haya pagado y avisarle al comprador. *(Origen: RQNF10.7.)*
- **RF-REP-03** `[Aprobado · Implementado]` — Un vendedor con cuenta cancelada solo puede completar entregas cuyo pago ya estaba confirmado. *(Origen: RQF12.)*
- **RNF-REP-08** `[Aprobado · Implementado]` — El vendedor cancelado no puede publicar, editar, recibir nuevas filas ni usar otras funciones. *(Origen: RQNF10.1.)*
- **RNF-REP-09** `[Aprobado · Implementado]` — Si el vendedor cancelado no registra el código de entrega dentro del plazo, el sistema debe cancelar y reembolsar el monto retenido. *(Origen: RQNF10.2.)*
- **RF-REP-04** `[Aprobado · Implementado]` — El comprador debe ver un aviso cuando sea retirado de una fila por cancelación de la cuenta del vendedor. *(Origen: RQF10 duplicado.)*
- **RNF-REP-10** `[Aprobado · Implementado]` — El aviso debe indicar que el producto no está disponible y eliminar la fila de la lista activa del comprador. *(Origen: RQNF10.1 duplicado.)*

## 7. Módulo 4 — Fila virtual y catálogo del comprador

### 7.1. Catálogo y navegación

- **RF-FIL-01** `[Aprobado · Implementado]` — El comprador debe ver en cada elemento del catálogo la imagen principal, el precio y el nombre del artículo. *(Origen: RQF15.)*
- **RNF-FIL-01** `[Aprobado · Implementado]` — El catálogo debe mostrar únicamente publicaciones activas. *(Origen: RQNF15.1.)*
- **RNF-FIL-02** `[Aprobado · Implementado]` — El catálogo debe cargar 12 elementos iniciales y ampliarse de 12 en 12 al llegar al final, usando Intersection Observer y paginación sobre MongoDB. *(Origen: RQNF15.3.)*
- **RF-FIL-02** `[Aprobado · Implementado]` — El comprador debe usar la barra de navegación para acceder a Inicio, Chats, Categorías, Promocionales, Nosotros, Ayuda e Iniciar sesión. *(Origen: RQF15.1.)*
- **RNF-FIL-03** `[Aprobado · Implementado]` — Cada opción de la barra debe redirigir a su sección correspondiente. *(Origen: RQNF15.5.)*

### 7.2. Ingreso a la fila

- **RF-FIL-03** `[Aprobado · Implementado]` — El comprador debe presionar “Entrar en la fila” para registrarse en un producto disponible. *(Origen: RQF16.)*
- **RNF-FIL-04** `[Aprobado · Implementado]` — La fila debe respetar estrictamente el orden FIFO. *(Origen: RQNF12 duplicado.)*
- **RNF-FIL-05** `[Aprobado · Implementado]` — Un comprador puede tener como máximo tres filas simultáneas. *(Origen: RQNF13 duplicado.)*
- **RF-FIL-04** `[Aprobado · Implementado]` — Al intentar una cuarta fila, el comprador debe ver “Ya estás en 3 filas. Abandona una para continuar”. *(Origen: RQF16.1.)*
- **RNF-FIL-06** `[Aprobado · Implementado]` — El sistema debe contar las filas activas antes de registrar una nueva. *(Origen: RQNF16.3.)*
- **RNF-FIL-07** `[Aprobado · Implementado]` — El sistema debe impedir la cuarta fila y mantener intactas las tres existentes. *(Origen: RQNF16.4.)*

### 7.3. Disponibilidad por horario

- **RF-FIL-05** `[Aprobado · Implementado]` — Al pasar el cursor sobre un producto, el comprador debe ver si está disponible o inactivo por horario y, si aplica, el horario del vendedor. *(Origen: RQF16.2.)*
- **RNF-FIL-08** `[Aprobado · Implementado]` — Los productos cuyo vendedor está fuera de su bloque de atención deben mostrarse como inactivos. *(Origen: RQNF16.6.)*
- **RNF-FIL-09** `[Aprobado · Implementado]` — El indicador de disponibilidad debe aparecer al detectar el cursor sobre el producto. *(Origen: RQNF16.7.)*
- **RNF-FIL-10** `[Aprobado · Implementado]` — La opción “Entrar en la fila” debe estar deshabilitada en productos inactivos. *(Origen: RQNF16.8.)*
- **RNF-FIL-11** `[Aprobado · Implementado]` — El sistema debe calcular la fecha y hora del siguiente bloque de atención a partir de los horarios guardados por el vendedor. *(Origen: RQNF16.8 duplicado.)*
- **RNF-FIL-12** `[Aprobado · Implementado]` — No se debe permitir el ingreso a la fila de un producto fuera del horario de atención, sin ocultar ni eliminar la publicación. *(Origen: RQNF17.4.)*

### 7.4. Pago inmediato o espera del siguiente bloque

- **RF-FIL-06** `[Aprobado · Implementado]` — Cuando el comprador llega al primer lugar y el bloque está por terminar, debe elegir “Pagar ahora” o “Esperar al siguiente bloque”. *(Origen: RQF18 y RQF18.1.)*
- **RNF-FIL-13** `[Aprobado · Implementado]` — El bloque se considera próximo a finalizar cuando el tiempo restante es menor al límite de pago del producto. *(Origen: RQNF18.1.)*
- **RNF-FIL-14** `[Aprobado · Implementado]` — El comprador conserva el primer lugar mientras decide. *(Origen: RQNF18.2.)*
- **RNF-FIL-15** `[Aprobado · Implementado]` — El sistema debe guardar la opción elegida. *(Origen: RQF18 y RQNF18.2; se corrige una cita inexistente del documento original. Ver ANEXO III.)*
- **RNF-FIL-16** `[Aprobado · Implementado]` — Si elige “Pagar ahora”, conserva el tiempo límite completo y el chat queda bloqueado hasta que el vendedor confirme el comprobante; si el vendedor no está disponible, la atención se dará en el siguiente bloque. *(Origen: RQNF18.4, corregido.)*
- **RNF-FIL-17** `[Aprobado · Implementado]` — Si elige “Esperar al siguiente bloque”, el conteo del tiempo límite de pago inicia al comenzar ese bloque. *(Origen: RQNF18.5.)*
- **RNF-FIL-18** `[Aprobado · Implementado]` — Si el comprador abandona la fila, se libera el tiempo reservado y el turno pasa al siguiente. *(Origen: RQNF18.6.)*

### 7.5. Perfil del vendedor y posición en la fila

- **RF-FIL-07** `[Aprobado · Implementado]` — El comprador debe poder abrir el perfil del vendedor y ver reputación, productos activos y horario de atención. *(Origen: RQF17.)*
- **RNF-FIL-19** `[Aprobado · Implementado]` — El perfil debe mostrar solo datos públicos del vendedor. *(Origen: RQNF17.1.)*
- **RNF-FIL-20** `[Aprobado · Implementado]` — Fuera del horario, las publicaciones del vendedor deben mostrarse en modo de solo consulta. *(Origen: RQNF17.2 y RQF17.1.)*
- **RNF-FIL-21** `[Aprobado · Implementado]` — La disponibilidad debe calcularse con la fecha y hora de la zona centro (GMT-6). *(Origen: RQNF17.3.)*
- **RF-FIL-08** `[Aprobado · Implementado]` — El comprador debe ver su posición en cada fila mediante una burbuja flotante. *(Origen: RQF19.)*
- **RNF-FIL-22** `[Aprobado · Implementado]` — La posición debe calcularse con el orden FIFO. *(Origen: RQNF19.1.)*
- **RNF-FIL-23** `[Aprobado · Implementado]` — La posición debe actualizarse automáticamente sin recargar la página, con un refresco máximo de 5 segundos. No se exige WebSocket. *(Origen: RQNF19.2, corregido.)*
- **RNF-FIL-24** `[Aprobado · Implementado]` — El comprador debe ser retirado automáticamente de la fila cuando su venta se complete con éxito. *(Origen: RQNF19.3.)*
- **RF-FIL-09** `[Aprobado · Implementado]` — Si otro comprador concreta la compra, el comprador en espera debe ver que el producto ya no está disponible y que fue retirado de la fila. *(Origen: RQF19.1.)*
- **RNF-FIL-25** `[Aprobado · Implementado]` — Al concluir una venta, el sistema debe cerrar la fila y retirar a todos los compradores en espera. *(Origen: RQNF19.4.)*
- **RNF-FIL-26** `[Aprobado · Implementado]` — El aviso de producto no disponible debe eliminar la fila de la lista activa y actualizar la burbuja. *(Origen: RQNF19.5.)*

### 7.6. Alertas por correo

- **RF-FIL-10** `[Aprobado · Implementado]` — El comprador debe registrar su correo y seleccionar categorías para recibir alertas de productos nuevos. *(Origen: RQF20.)*
- **RNF-FIL-27** `[Aprobado · Implementado]` — El correo debe tener formato válido y debe seleccionarse al menos una categoría. *(Origen: RQNF20.1.)*
- **RNF-FIL-28** `[Aprobado · Implementado]` — El sistema debe guardar el correo y las categorías seleccionadas. *(Origen: RQNF20.2.)*
- **RNF-FIL-29** `[Aprobado · Implementado]` — Las alertas deben enviarse a las 10:00 y 17:00 horas GMT-6. *(Origen: RQNF20.4.)*
- **RNF-FIL-30** `[Aprobado · Implementado]` — El sistema debe agrupar las publicaciones nuevas en un solo correo y no enviar nada si no hay novedades. *(Origen: RQNF20.5 y RQF20.2.)*
- **RNF-FIL-31** `[Aprobado · Implementado]` — El sistema no debe limitar el número de compradores que pueden formarse en la fila de un producto durante el bloque de atención; el único límite es de tres filas simultáneas por comprador. *(Origen: RQNF16.5.)*

## 8. Módulo 5 — Pagos, comprobantes y escrow

### 8.1. Pago

- **RF-PAG-01** `[Aprobado · Implementado]` — El comprador debe pagar con PayPal o Mercado Pago, según la configuración del vendedor. *(Origen: RQF21 y RQNF18, corregido.)*
- **RNF-PAG-01** `[Aprobado · Implementado]` — El sistema debe redirigir al comprador al checkout de la pasarela correspondiente. *(Origen: RQNF18.)*
- **RNF-PAG-02** `[Aprobado · Implementado]` — El sistema debe autorizar o capturar el pago en escrow antes de considerarlo confirmado. *(Origen: RQNF4.)*
- **RNF-PAG-03** `[Aprobado · Implementado]` — El pago debe registrarse en PostgreSQL y reflejarse en el espejo de MongoDB. *(Origen: arquitectura del proyecto.)*

### 8.2. Comprobante

- **RF-PAG-02** `[Aprobado · Implementado]` — El comprador debe registrar su comprobante con la palabra clave asignada, el número de referencia y una fotografía o captura. *(Origen: RQF22.)*
- **RNF-PAG-04** `[Aprobado · Implementado]` — El sistema debe validar que palabra clave, referencia e imagen estén presentes antes de permitir el envío. *(Origen: RQNF22.1.)*
- **RNF-PAG-05** `[Aprobado · Implementado]` — La palabra clave ingresada debe coincidir con la asignada a la sesión de pago. *(Origen: RQNF22.2.)*
- **RNF-PAG-06** `[Aprobado · Implementado]` — El comprobante solo se captura con palabra clave, referencia e imagen; no se valida que la referencia aparezca en la imagen ni se compara con el ticket. *(Origen: nota de la línea 370; decisión del cliente del 24/10/2026.)*
  - **Implementado:** el backend guarda los tres datos y aplica SafeSearch a la imagen; la validación contra el contenido del ticket quedó fuera de alcance por decisión expresa.
- **RNF-PAG-07** `[Aprobado · Implementado]` — El comprobante debe ser `.png`, `.jpeg` o `.jpg`, medir entre 420 × 540 y 2560 × 2560 píxeles. *(Origen: RQNF22.3.)*
- **RNF-PAG-08** `[Aprobado · Implementado]` — El sistema debe analizar el comprobante con Google Cloud Vision (`SafeSearch`) antes de mostrarlo al vendedor y bloquear contenido inapropiado. *(Origen: RQNF22.4.)*
  - **Implementado:** smoke test real de `SAFE_SEARCH_DETECTION` con HTTP 200 (adult/spoof/violence/racy `VERY_UNLIKELY`). La suite de escrow verifica que una imagen marcada como inapropiada se bloquea y no cambia el estado de la venta.
- **RNF-PAG-09** `[Aprobado · Implementado]` — El sistema debe guardar palabra clave, referencia e imagen en el historial de la transacción. *(Origen: RQNF22.5.)*
- **RF-PAG-03** `[Aprobado · Implementado]` — El comprador debe ver la palabra clave asignada al completar el pago. *(Origen: RQF22.1.)*
- **RNF-PAG-10** `[Aprobado · Implementado]` — La palabra clave debe ser numérica, de 4 dígitos y única por cada sesión de pago exitosa de un mismo producto. *(Origen: RQNF22.6, corregido.)*
- **RNF-PAG-11** `[Aprobado · Implementado]` — El comprobante solo debe ser visible para el comprador, el vendedor y el administrador autorizado; nunca como archivo estático público. *(Origen: privacidad y RQF30.)*

### 8.3. Pausa, confirmación y código de entrega

- **RF-PAG-04** `[Aprobado · Implementado]` — Al registrar el comprobante, la fila debe quedar en reposo y la venta en `pendiente_confirmacion`. *(Origen: RQNF24.4 y RQNF18.)*
- **RNF-PAG-12** `[Aprobado · Implementado]` — El sistema debe pausar la fila al recibir el comprobante, sin generar todavía el código de entrega. *(Origen: RQNF24.4, corregido.)*
- **RNF-PAG-13** `[Aprobado · Implementado]` — El código de entrega debe generarse únicamente cuando el vendedor confirme el comprobante. *(Origen: RQNF24.4, corregido.)*
- **RF-PAG-05** `[Aprobado · Implementado]` — El vendedor debe revisar la referencia y la imagen del comprobante desde su panel o el chat. *(Origen: RQF30.)*
- **RF-PAG-06** `[Aprobado · Implementado]` — El vendedor debe poder confirmar o rechazar el comprobante. *(Origen: RQF31.)*
- **RNF-PAG-14** `[Aprobado · Implementado]` — Al confirmar, el sistema debe abrir el chat, generar el código de entrega y establecer el plazo de entrega. *(Origen: RQNF29 y RQNF24.4.)*
- **RNF-PAG-15** `[Aprobado · Implementado]` — Al rechazar, el sistema debe reembolsar al comprador y pasar el turno al siguiente. *(Origen: RQNF23.1 y RQNF23.2.)*
- **RF-PAG-07** `[Aprobado · Implementado]` — El vendedor debe registrar el código de entrega proporcionado por el comprador para finalizar la transacción. *(Origen: RQF33 y RQF26.)*
- **RNF-PAG-16** `[Aprobado · Implementado]` — El sistema debe validar el código y liberar los fondos retenidos al vendedor. *(Origen: RQNF26, RQNF27 y RQF26.)*
- **RF-PAG-08** `[Aprobado · Implementado]` — Si el vendedor no confirma el comprobante antes del fin de su siguiente bloque de atención, el sistema debe cancelar y reembolsar automáticamente. *(Origen: RQNF24.)*
- **RNF-PAG-17** `[Aprobado · Implementado]` — El plazo de confirmación debe calcularse con los bloques de atención del vendedor y debe informar fecha y hora de resolución. *(Origen: RQNF24.)*
- **RNF-PAG-18** `[Aprobado · Implementado]` — El reembolso debe ejecutarse con la pasarela correspondiente y reflejarse en el historial. *(Origen: RQNF24 y RQNF28.)*

### 8.4. Comisiones, IVA y transparencia

- **RF-PAG-09** `[Aprobado · Implementado]` — El sistema debe informar al usuario las comisiones de la plataforma y de las pasarelas, así como el IVA aplicable. *(Origen: políticas de privacidad y correcciones de transparencia.)*
  - **Implementado:** la nota de comisiones aparece al registrar/publicar, en las políticas y en el panel del vendedor antes de liberar cada pago.
- **RNF-PAG-19** `[Aprobado · Implementado]` — La comisión de Ichiba debe expresarse como 5 % + IVA (16 %), equivalente a 5.8 % del precio de venta, y las tarifas de PayPal y Mercado Pago deben mostrarse por transacción. *(Origen: política de privacidad.)*
  - **Implementado:** `comisionService` calcula base (5 %), IVA (16 % de la base), total (5.8 %) y neto. La API y el panel muestran el desglose por venta y los totales cobrados/por cobrar.
- **RNF-PAG-20** `[Aprobado · Parcial]` — El sistema debe descontar realmente la comisión del pago al vendedor y no cobrarla en ventas reembolsadas. *(Origen: política de privacidad; decisión del cliente del 24/10/2026.)*
  - **Implementado en código:** PayPal recibe `payment_instruction.platform_fees` por 5.8 % al capturar la autorización (no al crear la orden) y el reembolso devuelve esa comisión; MercadoPago retiene el neto en la cuenta de la plataforma. Las ventas canceladas o reembolsadas muestran comisión cero y el neto se informa al vendedor.
  - **Parcial:** el cobro real con PayPal requiere enrolar la cuenta en **PayPal Complete Payments Platform (Marketplaces and Platforms)** y enrolar a los vendedores. `PAYPAL_PLATFORM_MERCHANT_ID` es opcional; si se omite, la comisión se acredita a la cuenta dueña de la app. Mientras no esté aprobado, `PAYPAL_COMISION_MODO=registro` permite operar sin cobrar, pero no debe usarse para declarar la comisión como cobrada en producción.

## 9. Módulo 6 — Chat, entrega y calificación

> Los requisitos de este módulo provienen del bloque `RQF23`–`RQF33`, marcado en el documento original como **no revisado por quien autoriza**.
>
> **Actualización 24/10/2026:** el cliente delegó la revisión de este bloque y lo aprobó. Por eso los requisitos pasan a `[Aprobado]`; además se confirmó que el chat solo **avisa** el horario, no lo bloquea, y que la burbuja de fila puede refrescarse cada 5 segundos.
>
> **Actualización 03/11/2026:** se documenta el detalle de RQNF31 en RNF-CHA-04 y se confirma que RQNF24.1 solo obliga a avisar el horario. El chat no se bloquea por horario; publicaciones, productos y filas sí.

- **RF-CHA-01** `[Aprobado · Implementado]` — Comprador y vendedor deben contar con un chat interno para coordinar la entrega después de que el vendedor confirme el pago y el comprobante. *(Origen: RQF24.)*
- **RNF-CHA-01** `[Aprobado · Implementado]` — El chat solo debe habilitarse en estado `en_entrega`; antes debe estar bloqueado y después de completada o cancelada debe quedar deshabilitado. *(Origen: RQNF24.2 y RQNF29.)*
- **RNF-CHA-02** `[Aprobado · Implementado]` — Todos los mensajes deben conservarse en el historial de la transacción como evidencia auditable. *(Origen: RQNF30.)*
- **RNF-CHA-03** `[Aprobado · Implementado]` — El sistema debe filtrar palabras prohibidas y moderar imágenes enviadas por el chat. *(Origen: RQF29 y filtros del proyecto.)*
  - **Implementado:** las imágenes del chat pasan por `SafeSearch` antes de guardarse; si la moderación falla o detecta contenido inapropiado, se rechaza el mensaje y se borra el archivo. La suite de escrow lo verifica con una imagen bloqueada y una permitida.
- **RNF-CHA-04** `[Aprobado · Implementado]` — Si no hay actividad en el chat durante tres bloques de atención, el sistema debe cancelar la transacción y reembolsar al comprador. *(Origen: RQNF31.)*
  - **Detalle 03/11/2026:** el contador inicia con el último mensaje o, si aún no hay mensajes, con la confirmación del comprobante; abarca los próximos tres bloques de atención del vendedor. Si no hay bloques suficientes, se aplica el límite de entrega de 15 días. Al vencer, el job cancela y reembolsa sin intervención; si la venta está retenida o el reembolso falla, la resuelve un administrador.
- **RNF-CHA-05** `[Aprobado · Implementado]` — El chat debe deshabilitarse inmediatamente al registrarse el código de entrega o al cancelarse la transacción. *(Origen: RQNF26.)*
- **RNF-CHA-06** `[Aprobado · Implementado]` — El sistema debe advertir que la atención del vendedor se presta dentro de su horario, sin bloquear técnicamente el chat por horario. *(Origen: RQNF24.1, corregido.)*
  - **Decisión confirmada:** el chat solo avisa; el vendedor puede responder cuando quiera. Las publicaciones, los productos y las filas sí se bloquean fuera de horario.
- **RNF-CHA-07** `[Aprobado · Implementado]` — El administrador debe poder auditar el historial completo de mensajes de una venta en caso de conflicto. *(Origen: RQF39.)*
- **RF-CHA-02** `[Aprobado · Implementado]` — Comprador y vendedor deben poder acordar lugar, fecha, hora y método de entrega por mensajes de texto. *(Origen: RQF35.)*
- **RNF-CHA-08** `[Aprobado · Implementado]` — El chat debe permitir mensajes de texto y adjuntos permitidos, con validación de contenido. *(Origen: RQF35.)*
- **RF-CHA-03** `[Aprobado · Implementado]` — El comprador puede calificar al vendedor de 1 a 5 estrellas después de confirmada la entrega. *(Origen: RQF27.)*
- **RNF-CHA-09** `[Aprobado · Implementado]` — La calificación debe ser opcional, entera, de 1 a 5, y solo permitirse cuando la venta esté completada. *(Origen: RQNF24.2.)*
- **RF-CHA-04** `[Aprobado · Implementado]` — El comprador puede abandonar voluntariamente la fila en cualquier momento. *(Origen: RQF28.)*
- **RNF-CHA-10** `[Aprobado · Implementado]` — Al abandonar, el sistema debe retirar al comprador y asignar el turno al siguiente en espera. *(Origen: RQNF23.)*
- **RF-CHA-05** `[Aprobado · Implementado]` — El comprador puede comentar en publicaciones promocionales o iniciar chat con el vendedor si este lo permite. *(Origen: RQF29.)*
- **RNF-CHA-11** `[Aprobado · Implementado]` — Los comentarios deben ser visibles para todos los usuarios. *(Origen: RQNF24.2.)*
- **RNF-CHA-12** `[Aprobado · Implementado]` — El chat con el vendedor solo debe habilitarse si el vendedor lo permite. *(Origen: RQNF24.2.)*
- **RF-CHA-06** `[Aprobado · Implementado]` — El vendedor debe consultar el estado de sus filas y el número de personas en espera. *(Origen: RQF32.)*
- **RNF-CHA-13** `[Aprobado · Implementado]` — El panel del vendedor debe mostrar solo las filas de productos activos. *(Origen: RQNF24.2.)*

## 10. Módulo 7 — Administración y BackOffice

> Este bloque también proviene de la parte no revisada del documento original. Se reformula para que el BackOffice quede completo.
>
> **Actualización 24/10/2026:** el cliente delegó la revisión de este bloque y lo aprobó; los requisitos pasan a `[Aprobado]`. El BackOffice, sus suscripciones GraphQL y el servidor MCP ya estaban implementados y desplegados.

- **RF-ADM-01** `[Aprobado · Implementado]` — El administrador debe consultar usuarios, verificar su información, suspender cuentas, reactivarlas y monitorear su historial. *(Origen: RQF36.)*
- **RNF-ADM-01** `[Aprobado · Implementado]` — Las acciones administrativas deben quedar registradas con fecha, administrador y motivo. *(Origen: RQF38/RQF39.)*
- **RF-ADM-02** `[Aprobado · Implementado]` — El administrador debe revisar denuncias y reportes de fraude, publicaciones engañosas, lenguaje ofensivo, spam, discriminación o incumplimiento. *(Origen: RQF37.)*
- **RNF-ADM-02** `[Aprobado · Implementado]` — El sistema debe permitir confirmar o rechazar un reporte y reflejar la decisión en la reputación o sanción correspondiente. *(Origen: RQNF23.1.)*
- **RF-ADM-03** `[Aprobado · Implementado]` — El administrador debe consultar el historial de filas, pagos, comprobantes, tiempos de respuesta y transacciones. *(Origen: RQF38.)*
- **RNF-ADM-03** `[Aprobado · Implementado]` — El historial debe ser filtrable y mostrar la evidencia de cada transacción. *(Origen: RQF38.)*
- **RF-ADM-04** `[Aprobado · Implementado]` — El administrador debe dictaminar disputas de reembolso evaluando evidencias de ambas partes. *(Origen: RQF40.)*
- **RNF-ADM-04** `[Aprobado · Implementado]` — Las evidencias deben incluir comprobantes, fotografías del producto y capturas de conversaciones, y solo deben ser visibles para las partes autorizadas y el administrador. *(Origen: RQF40.)*
- **RF-ADM-05** `[Aprobado · Implementado]` — El administrador debe consultar y mantener la lista negra de RFC e identificaciones oficiales. *(Origen: RQNF36.)*
- **RNF-ADM-05** `[Aprobado · Implementado]` — El registro debe consultar la lista negra y denegar coincidencias sin revelar el dato que coincidió. *(Origen: RQNF36.)*
- **RF-ADM-08** `[Aprobado · Implementado]` — El administrador debe revisar las solicitudes de revisión de altas denegadas y responderlas por correo a la persona. *(Origen: RQNF1.9 y RQF1.1.)*
- **RNF-ADM-13** `[Aprobado · Implementado]` — Las solicitudes de revisión deben llegar en vivo al panel por la suscripción `solicitudesRegistro`. *(Origen: RQNF1.9.)*
- **RF-ADM-06** `[Aprobado · Implementado]` — El administrador debe consultar informes globales de la plataforma. *(Origen: BackOffice.)*
- **RNF-ADM-06** `[Aprobado · Implementado]` — Los informes globales deben actualizarse en vivo por la suscripción `resumenAdmin`. *(Origen: BackOffice.)*
- **RF-ADM-07** `[Aprobado · Implementado]` — El administrador debe consultar y liquidar adeudos de vendedores. *(Origen: RQNF37 y RQNF38.)*
- **RNF-ADM-07** `[Aprobado · Implementado]` — Si la plataforma cubre un reembolso por culpa del vendedor, debe suspenderlo y registrar el saldo pendiente. *(Origen: RQNF37.)*
- **RNF-ADM-08** `[Aprobado · Implementado]` — La reactivación de una cuenta con adeudo debe condicionarse a la liquidación total. *(Origen: RQNF38.)*
- **RNF-ADM-09** `[Aprobado · Implementado]` — El sistema debe retener preventivamente el pago en escrow ante reportes, disputas o evidencias de irregularidad antes de la entrega. *(Origen: RQNF32.)*
- **RNF-ADM-10** `[Aprobado · Implementado]` — El sistema debe aplicar bloqueos temporales automáticos según el tipo de infracción y la reincidencia, y desbloquear al concluir el periodo. *(Origen: RQNF33.)*
- **RNF-ADM-11** `[Aprobado · Implementado]` — Las sanciones deben incrementar progresivamente hasta una suspensión prolongada o indefinida. *(Origen: RQNF34.)*
- **RNF-ADM-12** `[Aprobado · Implementado]` — Las faltas graves como fraude comprobado, suplantación, amenazas o comprobantes falsos deben suspender indefinidamente y enviar a revisión administrativa. *(Origen: RQNF35.)*

## 11. Requisitos que se consolidaron

No se eliminó ningún requisito original. Los duplicados se fusionaron así:

- `RQF6` (tres apariciones) → `RF-AUT-06`, `RNF-AUT-27` y `RF-AUT-07`.
- `RQNF6` (tres apariciones) → `RNF-AUT-22` a `RNF-AUT-30`.
- `RQNF1.1` (dos apariciones) → `RNF-AUT-01` y `RNF-AUT-10`.
- `RQNF7.3` (tres apariciones) → `RNF-CAT-03`, `RNF-CAT-09` y `RNF-CAT-10`.
- `RQNF7.4` y `RQNF7.5` (duplicados) → `RNF-CAT-04`, `RNF-CAT-05`, `RNF-CAT-08` y `RNF-CAT-11`.
- `RQF10` y `RQNF10.1`–`RQNF10.3` (duplicados) → `RF-REP-01`, `RF-REP-03`, `RF-REP-04`, `RNF-REP-02`, `RNF-REP-03`, `RNF-REP-08`, `RNF-REP-09` y `RNF-REP-10`.
- `RQF11` y `RQNF11.1` (duplicados) → `RF-REP-02`, `RNF-CAT-22` y `RNF-CAT-23`.
- `RQNF12` y `RQNF13` (duplicados) → `RNF-CAT-26`, `RNF-FIL-04` y `RNF-FIL-05`.
- `RQNF13.2` (duplicado) → `RNF-CAT-28` y `RNF-CAT-29`.
- `RQNF16.8` (duplicado) → `RNF-FIL-10` y `RNF-FIL-11`.
- `RQNF18` (duplicado) → `RF-PAG-01` y `RNF-PAG-01`.
- `RQNF24.2` (seis apariciones) → `RNF-CHA-01`, `RNF-CHA-09`, `RNF-CHA-11`, `RNF-CHA-12` y `RNF-CHA-13`.
- `RQNF31` (fuera de orden) → `RNF-CHA-04`.

## 12. Decisiones que necesito que confirmes

1. **Comisión 5 % + IVA:** ¿debe descontarse realmente del pago al vendedor o solo mostrarse en la política y en la interfaz? Hoy no encontré lógica de descuento en el backend.
2. **Referencia del comprobante:** ¿basta con que el comprador escriba la referencia, o debe validarse que aparezca en la imagen/ticket? La validación contra la imagen no está implementada.
3. **Chat y horario:** ¿el chat debe bloquearse fuera del horario del vendedor o solo advertir que la atención será en el siguiente bloque? Hoy solo advierte.
4. **Burbuja de fila:** ¿aceptas el refresco cada 5 segundos o necesitas WebSocket para considerarlo “tiempo real”?
5. **Bloque RQF23–RQF33:** ¿se aprueba tal como está reformulado o quieres eliminar o cambiar algún requisito?
6. **PayPal en producción:** ¿tienes la app live y la URL de callback registrada, o seguimos con sandbox?
7. **Google Vision:** ¿se activará facturación, se usará otro proyecto con facturación o cambiamos a moderación manual/local?
8. **P0:** ¿autorizas rotar `JWT_SECRET` y suspender las cuentas demo de producción?

### 12.1. Decisiones resueltas (24/10/2026)

1. **Comisión:** se cobra realmente. Ichiba retiene **5 % + IVA = 5.8 %**; el vendedor ve el desglose y su neto antes de liberar el pago. PayPal usa `platform_fees` y MercadoPago retiene el neto en la cuenta de la plataforma.
2. **Comprobante:** solo se capturan palabra clave, referencia e imagen. **No** se valida que la referencia aparezca en la imagen ni se compara con el ticket.
3. **Chat y horario:** el chat solo **avisa** el horario de atención; no se bloquea por horario. Publicaciones, productos y filas sí se bloquean fuera del horario.
4. **Burbuja de fila:** se acepta el refresco cada **5 segundos**; no se exige WebSocket.
5. **Bloque RQF23–RQF40:** aprobado por delegación del cliente. Se mantienen las reformulaciones del ANEXO II y los estados pasan de `[Propuesto]` a `[Aprobado]`.
6. **PayPal en producción:** el código OAuth quedó corregido (`redirect_uri` en autorización e intercambio, permiso `email`). Falta la app live, el callback registrado y el enrolamiento en **PayPal Complete Payments Platform**; hasta entonces la vinculación real sigue pendiente.
7. **Google Vision:** facturación activada y misma API key. `LABEL_DETECTION` y `SAFE_SEARCH_DETECTION` responden HTTP 200; no se configura `GOOGLE_VISION_ENDPOINT` ni `VISION_MODERACION=omitir` en producción.
8. **P0:** sigue pendiente de autorización y ejecución. No se rotó `JWT_SECRET` ni se suspendieron las cuentas demo en producción.

## 13. Resumen de verificación

- **Funcional y aprobado:** registro, autenticación, horarios, catálogo, fila virtual, pagos, comprobantes, chat, escrow, reportes, sanciones, BackOffice, suscripciones GraphQL, MCP, CI/CD, comisión 5 % + IVA y moderación con Vision.
- **Parcial:** integración de PayPal en producción (falta app live, callback y Complete Payments), cobro real de la comisión con PayPal mientras no esté enrolada la cuenta de plataforma, y P0 de seguridad.
- **Bloqueado:** persistencia de uploads en Railway (sin volumen), cierre del P0 (`JWT_SECRET` y cuentas demo) y aprobación de PayPal Complete Payments.
- **Pruebas de esta corrida:** **351/351** (escrow 64, puntos/cancelación 48, informes 26, suscripciones 11, MCP 22, sanciones 30, disputas 65, fila/apertura 30, moderación 48 y comisión/PayPal 7); `npx tsc --noEmit` limpio en backend y frontend, y build de producción del frontend correcto.
- **Vision real:** `LABEL_DETECTION` HTTP 200 (`Blue`, 99 %); `SAFE_SEARCH_DETECTION` HTTP 200 (adult/spoof/violence/racy `VERY_UNLIKELY`).
- **Decisión de alcance:** el bloque RQF23–RQF40 quedó aprobado por delegación; no se eliminó ningún requisito original.

> **Cierre.** Este anexo no afirma que el proyecto esté al 100 %. Afirma que los requisitos ya están formulados de manera verificable y que existe una lista corta de decisiones y bloqueos externos antes de poder declararlo completo.

---

# ANEXO III — Revisión de trazabilidad y acuerdos del 03/11/2026

> Este anexo no sustituye el texto original ni elimina requisitos. Agrega la trazabilidad que faltaba, corrige citas inexistentes o genéricas y deja por escrito los acuerdos y hallazgos de la revisión. Con `RNF-FIL-31`, el ANEXO II queda en **203 requisitos implementados y 6 parciales**.

## 1. Mapeo de IDs originales y citas corregidas

| ID original | Requisito reformulado | Tratamiento |
|---|---|---|
| `RQF1.1` | `RNF-AUT-10` | Mismo intento: mensaje inmediato sin revelar el dato de la lista negra. Se agregó la referencia. |
| `RQNF2.2` | `RF-AUT-02` | Es la cara positiva de la misma regla: si acepta las notificaciones, el registro continúa. Se agregó la referencia. |
| `RQNF6.2` | `RNF-AUT-19` | Duplicado de `RQNF5.2` (una hora de atención por semana). Se agregó la referencia. |
| `RQNF16.5` | `RNF-FIL-31` | Nuevo requisito: la fila por producto no tiene límite de compradores; solo hay tres filas simultáneas por comprador. |
| `RQF17.1` | `RNF-FIL-20`, `RNF-FIL-10` y `RNF-FIL-11` | Se dividió en solo consulta, botón deshabilitado y cálculo del siguiente bloque. |
| `RQF18.1` | `RF-FIL-06` y `RNF-FIL-16`/`RNF-FIL-17` | Se conserva la advertencia y la elección; el chat solo avisa el horario, no se bloquea por horario. |
| `RQF20.2` | `RNF-FIL-30` | El comprador recibe las publicaciones nuevas de las categorías que eligió, agrupadas en un correo. |
| `RQF25` | `RF-REP-01` y `RNF-REP-01` | Cubre reportes por estafa, fotos inapropiadas, palabras malsonantes y discriminación. |
| `RQNF25.1` | `RNF-REP-04` | Los reportes con “otro motivo” se guardan para revisión manual. |
| `RQF26` | `RF-PAG-07` y `RNF-PAG-16` | El código de entrega se captura y se valida para liberar el pago. |
| `RQNF8` | `RF-CAT-02` y `RNF-CAT-13` | Alerta de palabra prohibida en publicaciones; se agregó la referencia al ID general. |
| `RQNF10` | `RNF-CAT-18` | Alerta de palabra prohibida en promocionales; se agregó la referencia al ID general. |
| `RQNF18.3` | `RNF-FIL-15` | La cita no existe en el texto original; se corrigió el origen a `RQF18` y `RQNF18.2`. |
| `RQNF9` | `RNF-CAT-16`, `RNF-CAT-18` y `RNF-CAT-21` | Era una cita genérica sin subíndice; se reemplazó por `RQF9` y `RQNF9.1–RQNF9.5`. |

## 2. Aclaraciones aprobadas

- **RQNF31 — inactividad del chat.** Se cuentan tres bloques de atención del vendedor desde el último mensaje o, si no hay mensajes, desde la confirmación del comprobante. Si no hay bloques suficientes, aplica el límite de entrega de 15 días. Al vencer, el sistema cancela y reembolsa sin pedir permiso; si la venta está retenida o el reembolso falla, la resuelve un administrador.
- **RQNF24.1 — horario del chat.** Solo obliga a advertir el horario. El vendedor puede responder cuando quiera. Las publicaciones, los productos y las filas sí se bloquean fuera de horario.
- **RQNF18.3 — cita corregida.** El texto original no contiene ese ID. La obligación de guardar la opción elegida queda cubierta por `RQF18` y `RQNF18.2`.

## 3. Hallazgos de la revisión

1. **Rol de administrador — corregido en código.** El login ya lee el rol vigente de PostgreSQL y sincroniza el espejo de MongoDB; el middleware de `/admin` también valida PostgreSQL. Queda pendiente una prueba de regresión automatizada para este caso.
2. **Modo `PAYPAL_COMISION_MODO=registro` — abierto.** Una venta completada se muestra como “comisión cobrada / recibiste el neto”, pero PayPal no cobró la comisión. Hay que mostrar “comisión informativa, no cobrada” o impedir ese modo en producción.
3. **MercadoPago — abierto.** El dinero entra a la cuenta dueña del `MERCADOPAGO_ACCESS_TOKEN`; no hay transferencia automática al vendedor. Hay que decidir entre liquidación manual documentada o MercadoPago Marketplace, y ajustar el texto “recibiste el neto”.
4. **Neto antes de comisiones de pasarela — abierto.** El panel resta solo el 5.8 % de Ichiba; PayPal y MercadoPago cobran aparte. `RNF-PAG-19` exige mostrarlas por transacción: hay que calcularlas o etiquetarlas como estimadas.
5. **`RNF-CAT-17` — decisión pendiente.** Los promocionales no pasan por Vision por diseño. Se debe mantener formalmente la exención o crear una lista de etiquetas permitidas para promocionales.
6. **Bloqueos externos.** PayPal live con Complete Payments y seller onboarding, volumen persistente de Railway para `/app/uploads`, rotación de `JWT_SECRET`, suspensión de cuentas demo, promoción del admin en producción, limpieza del historial de Git y commit/push de esta versión.
7. **CI.** Las suites de moderación y eliminación de vendedor se ejecutan localmente, no en GitHub Actions. La de eliminación tampoco está incluida en el conteo de 351 pruebas.

## 4. Estado actualizado

- **203 implementados, 6 parciales, 0 bloqueados por requisito.**
- Parciales: `RF-GEN-04`, `RNF-GEN-03`, `RF-AUT-04`, `RNF-AUT-17`, `RNF-CAT-17` y `RNF-PAG-20`.
- La revisión de esta fecha no volvió a ejecutar las 351 pruebas para no modificar las bases locales; la última corrida documentada sigue siendo **351/351**. `npx tsc --noEmit` pasa en backend y frontend.
- No se eliminó ningún requisito del texto original. Las correcciones de esta revisión son aditivas.
