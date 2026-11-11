
const nodemailer = require('nodemailer');

async function probarCorreo() {
  let transportador;

  try {
    console.log('Creando cuenta temporal de prueba...');

    // Ethereal genera credenciales temporales para pruebas.
    const cuenta = await nodemailer.createTestAccount();

    console.log('Cuenta de prueba creada correctamente.');
    console.log('Servidor SMTP:', cuenta.smtp.host);
    console.log('Puerto SMTP:', cuenta.smtp.port);

    transportador = nodemailer.createTransport({
      host: cuenta.smtp.host,
      port: cuenta.smtp.port,
      secure: cuenta.smtp.secure,
      auth: {
        user: cuenta.user,
        pass: cuenta.pass,
      },
    });

    console.log('Verificando conexión SMTP...');

    await transportador.verify();

    console.log('Conexión SMTP verificada.');

    const resultado = await transportador.sendMail({
      from: {
        name: 'TUSA WOOD - Pruebas',
        address: cuenta.user,
      },
      to: 'cliente-prueba@example.com',
      subject: 'Prueba de correo - TUSA WOOD',
      text: [
        'Hola:',
        '',
        'Este es un correo de prueba del sistema TUSA WOOD.',
        'Estamos verificando las notificaciones de cotizaciones.',
        '',
        'Este mensaje no se entrega a una bandeja real.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #22272C;">
          <h2 style="color: #F07832;">TUSA WOOD</h2>
          <p>Hola:</p>
          <p>
            Este es un correo de prueba del sistema de cotizaciones.
          </p>
          <p>
            Estamos verificando que las notificaciones funcionen
            correctamente.
          </p>
          <hr>
          <small>Mensaje de prueba; no es una cotización real.</small>
        </div>
      `,
    });

    const enlace = nodemailer.getTestMessageUrl(resultado);

    console.log('\nCorreo de prueba generado correctamente.');
    console.log('ID del mensaje:', resultado.messageId);
    console.log('Destinatario de prueba:', 'cliente-prueba@example.com');

    if (enlace) {
      console.log('\nAbre este enlace para visualizar el correo:');
      console.log(enlace);
    } else {
      console.log('No se obtuvo un enlace de vista previa.');
    }
  } catch (error) {
    console.error('\nFalló la prueba de correo.');
    console.error('Detalle:', error.message);
    process.exitCode = 1;
  } finally {
    if (transportador) {
      transportador.close();
    }
  }
}

probarCorreo();
