import "./PoliticasDePrivasidad.css";

const ULTIMA_ACTUALIZACION = "octubre de 2026";

function PoliticasDePrivacidad() {
  return (
    <article className="privacidad">
      <h1>Políticas de privacidad</h1>
      <p className="privacidad__fecha">
        Última actualización: {ULTIMA_ACTUALIZACION}
      </p>

      <p className="privacidad__intro">
        En Ichiba cuidamos la información de compradores y vendedores. Esta
        política explica qué datos personales recopilamos, para qué los usamos,
        con quién los compartimos y cómo puedes ejercer tus derechos. Al crear
        una cuenta y usar la plataforma aceptas estas prácticas.
      </p>

      <section className="privacidad__seccion">
        <h2>1. Responsable de tus datos</h2>
        <p>
          Ichiba (en adelante «la plataforma») es el responsable del tratamiento
          de los datos personales que recopila a través de este sitio y sus
          servicios de compra, venta, fila virtual, chat y pagos. Para dudas o
          solicitudes puedes escribirnos por los canales de atención de la
          sección de Ayuda.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>2. Datos que recopilamos</h2>
        <ul>
          <li>
            <strong>Datos de registro:</strong> nombre completo, correo
            electrónico, contraseña (guardada con cifrado irreversible) y tipo
            de cuenta (comprador o vendedor).
          </li>
          <li>
            <strong>Verificación de vendedores:</strong> identificación oficial
            (INE) y selfie de verificación. Estos datos son personales
            sensibles y se tratan con tu consentimiento explícito.
          </li>
          <li>
            <strong>Datos de cobro:</strong> correo de la cuenta de PayPal o
            Mercado Pago donde recibirás tus pagos y, en el caso de PayPal, el
            token de vinculación cifrado que autoriza el cobro. Ichiba nunca ve
            las contraseñas de tus cuentas de pago.
          </li>
          <li>
            <strong>Actividad en la plataforma:</strong> publicaciones,
            comentarios, participación en la fila virtual, compras, ventas,
            comprobantes de pago, mensajes del chat de coordinación,
            calificaciones y reportes.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, tipo de navegador y
            uso del sitio para seguridad y funcionamiento. Usamos
            almacenamiento local del navegador para mantener tu sesión y
            recordar avisos ya vistos.
          </li>
        </ul>
      </section>

      <section className="privacidad__seccion">
        <h2>3. Para qué usamos tus datos</h2>
        <ul>
          <li>Crear y administrar tu cuenta y verificar tu identidad.</li>
          <li>
            Operar la compraventa: publicaciones, fila virtual, chat,
            confirmación de entregas y calificaciones.
          </li>
          <li>
            Procesar pagos y retenciones (escrow), reembolsos y comisiones a
            través de PayPal y Mercado Pago.
          </li>
          <li>
            Enviarte correos del servicio: confirmaciones de pago, códigos,
            avisos de fila, entregas y notificaciones críticas de tu cuenta.
          </li>
          <li>
            Prevenir fraudes, moderar contenido y atender reportes, disputas y
            aclaraciones.
          </li>
          <li>
            Generar estadísticas e informes de ventas para los vendedores y
            métricas agregadas de la plataforma.
          </li>
        </ul>
        <p>
          La base legal del tratamiento es el consentimiento que otorgas al
          registrarte y la ejecución del contrato que celebras al comprar o
          vender. En el caso de datos sensibles (INE y selfie) el
          consentimiento es expreso.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>4. Datos sensibles y su protección</h2>
        <p>
          La identificación oficial y la selfie de verificación se usan
          únicamente para comprobar que eres la persona que se registra como
          vendedor. No se muestran a otros usuarios, no se usan para fines
          publicitarios y solo el personal autorizado y el servicio de lectura
          automática de identificaciones las procesan. Cuando una cuenta de
          vendedor se cancela y ya no tiene entregas pendientes, estos datos se
          eliminan conforme a las políticas de la plataforma.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>5. Con quién compartimos tu información</h2>
        <ul>
          <li>
            <strong>PayPal y Mercado Pago:</strong> procesan los pagos. Les
            enviamos el monto y los datos necesarios para el cobro; ellos
            aplican sus propias políticas de privacidad.
          </li>
          <li>
            <strong>Servicios de verificación y moderación:</strong> lectura de
            identificaciones (StructOCR), moderación de imágenes (Google
            Vision) y envío de correos. Actúan como proveedores por cuenta de
            Ichiba.
          </li>
          <li>
            <strong>Autoridades:</strong> solo cuando exista una obligación
            legal o requerimiento oficial.
          </li>
        </ul>
        <p>
          Ichiba no vende ni renta tus datos personales. Las partes de una
          transacción ven únicamente la información necesaria para completarla:
          el vendedor ve tu comprobante y tus mensajes, y el comprador recibe
          sus códigos secretos (palabra clave y código de confirmación de
          entrega). El vendedor <strong>nunca</strong> tiene acceso al código
          de confirmación de entrega.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>6. Pagos, comisiones e IVA</h2>
        <p>
          Todos los precios se publican en pesos mexicanos (MXN). Al pagar, el
          dinero del comprador queda <strong>retenido</strong> en la
          plataforma (escrow) y solo se entrega al vendedor cuando el
          comprador proporciona el código de confirmación de entrega. El
          comprador paga el precio publicado; las comisiones se descuentan del
          monto que recibe el vendedor:
        </p>
        <ul>
          <li>
            <strong>Comisión de Ichiba:</strong> 5% + IVA (16%), equivalente a
            5.8% del precio de venta, por el uso de la plataforma.
          </li>
          <li>
            <strong>PayPal:</strong> aproximadamente 3.95% + $4.00 MXN por
            transacción, más IVA. En pagos internacionales la comisión puede
            ser mayor.
          </li>
          <li>
            <strong>Mercado Pago:</strong> aproximadamente 3.49% + $4.00 MXN
            por transacción aprobada con disponibilidad inmediata, más IVA. Si
            aceptas plazos de 14 o 30 días la comisión baja; OXXO y meses sin
            intereses pueden tener un costo adicional.
          </li>
        </ul>
        <p>
          Las tasas de las pasarelas son aproximadas, las fija cada proveedor y
          pueden cambiar según el método de pago y sus promociones. El IVA se
          calcula conforme a la legislación fiscal mexicana aplicable. Si una
          venta se cancela o se reembolsa conforme a las reglas de la
          plataforma, el comprador recibe su dinero y no se cobra la comisión
          de Ichiba por esa operación.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>7. Cuánto tiempo conservamos tus datos</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa y durante el
          tiempo necesario para cumplir obligaciones legales, fiscales, de
          seguridad y para atender aclaraciones o disputas. Los mensajes del
          chat se conservan como evidencia auditable de la transacción. Cuando
          una cuenta de vendedor cancelada termina sus entregas pendientes,
          sus datos personales se eliminan y solo se conserva la información
          estrictamente necesaria para fines estadísticos y legales.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>8. Seguridad de la información</h2>
        <p>
          Aplicamos medidas administrativas, técnicas y físicas razonables para
          proteger tus datos: contraseñas cifradas, tokens de pago cifrados,
          sesiones con token de acceso, acceso restringido a la identificación
          oficial y comprobantes visibles solo para las partes de cada
          transacción. Ningún sistema es completamente infalible; si detectas
          un problema de seguridad, repórtalo de inmediato por los canales de
          atención.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>9. Tus derechos</h2>
        <p>
          Puedes solicitar el acceso, la rectificación o la eliminación de tus
          datos personales, así como oponerte a ciertos tratamientos u otorgar
          o revocar tu consentimiento (derechos ARCO). También puedes
          actualizar tus preferencias de notificaciones desde tu panel: las
          notificaciones críticas de tu cuenta son obligatorias, y puedes
          elegir si recibes avisos de comentarios en tus publicaciones
          publicitarias. Para ejercer tus derechos escríbenos por la sección de
          Ayuda; responderemos en los plazos que marca la legislación
          aplicable.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>10. Menores de edad</h2>
        <p>
          Ichiba no está dirigida a menores de edad. Si detectamos una cuenta
          de una persona menor, podemos suspenderla y eliminar sus datos
          conforme a esta política.
        </p>
      </section>

      <section className="privacidad__seccion">
        <h2>11. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta política para reflejar cambios en el
          servicio o en la ley. Publicaremos la versión vigente en esta página
          con su fecha de actualización. Si el cambio es relevante, te lo
          avisaremos por los medios de contacto registrados.
        </p>
      </section>
    </article>
  );
}

export default PoliticasDePrivacidad;
