/*
 * crimses-forms — Worker compartido que recibe los formularios de contacto
 * de TODOS los sitios de clientes de CRIMSES y los manda por mail vía Resend.
 *
 * Cómo sumar un cliente nuevo: agregar una entrada a CLIENTS más abajo con
 * el origen exacto de su sitio (https://sudominio.com, sin barra al final)
 * y el mail real donde quiere recibir los mensajes. Nada más — no hace
 * falta que el cliente cree ninguna cuenta en ningún lado.
 */

const CLIENTS = {
  "https://crimses.com": { to: "ccrimses@gmail.com", label: "CRIMSES" },
  "https://www.crimses.com": { to: "ccrimses@gmail.com", label: "CRIMSES" },
  // Preview de develop de crimses-web — permite probar el formulario antes
  // de mergear a main, sin tocar el dominio real. Sumar el mismo tipo de
  // entrada (develop.<proyecto>.pages.dev) para cada sitio de cliente nuevo.
  "https://develop.crimses-web.pages.dev": { to: "ccrimses@gmail.com", label: "CRIMSES (preview)" },
  // Próximo cliente: agregar acá su origen real y su mail de destino.
};

// Etiquetas lindas para campos conocidos de formularios (además de
// name/email/message). Un campo que no esté acá igual se manda, solo que
// con su nombre técnico capitalizado en vez de una etiqueta a medida.
const FIELD_LABELS = {
  business: "Negocio",
  phone: "Teléfono",
  location: "Ubicación",
};

function labelFor(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const FROM_ADDRESS = "formulario@crimses.com";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders || {}),
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const client = CLIENTS[origin];

    // Preflight de CORS: el navegador lo manda solo antes del POST real.
    if (request.method === "OPTIONS") {
      if (!client) return new Response(null, { status: 403 });
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Método no permitido" }, 405);
    }

    if (!client) {
      // Origen no está en la lista de clientes: no procesamos el envío.
      return json({ error: "Origen no autorizado" }, 403);
    }

    let data;
    try {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    } catch (err) {
      return json({ error: "No se pudo leer el formulario" }, 400, corsHeaders(origin));
    }

    // Honeypot: un campo oculto en el HTML que ningún humano completa.
    // Si viene lleno, es un bot — respondemos éxito sin mandar nada, para
    // no delatarle al bot que lo filtramos.
    if (data._gotcha) {
      return json({ ok: true }, 200, corsHeaders(origin));
    }

    const name = String(data.name || "").trim().slice(0, 200);
    const email = String(data.email || "").trim().slice(0, 200);
    const message = String(data.message || "").trim().slice(0, 5000);

    if (!name || !email || !message) {
      return json({ error: "Faltan campos obligatorios" }, 400, corsHeaders(origin));
    }

    // Cualquier otro campo que tenga el formulario del cliente (rubro,
    // fecha, dirección, lo que sea) se agrega tal cual al cuerpo del mail,
    // sin que haga falta tocar este Worker por cada campo nuevo que sumen.
    const knownFields = new Set(["name", "email", "message", "_gotcha"]);
    const extraLines = Object.keys(data)
      .filter((key) => !knownFields.has(key) && String(data[key]).trim())
      .map((key) => `${labelFor(key)}: ${String(data[key]).trim().slice(0, 500)}`);

    const bodyText = [`Nombre: ${name}`, `Email: ${email}`]
      .concat(extraLines)
      .concat(["", message])
      .join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Formulario ${client.label} <${FROM_ADDRESS}>`,
        to: client.to,
        reply_to: email,
        subject: `Nuevo mensaje de contacto — ${client.label}`,
        text: bodyText,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, errText);
      return json(
        { error: "No se pudo enviar el mensaje, intentá más tarde" },
        502,
        corsHeaders(origin)
      );
    }

    return json({ ok: true }, 200, corsHeaders(origin));
  },
};
