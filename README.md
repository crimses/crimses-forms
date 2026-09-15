# crimses-forms

Worker de Cloudflare compartido: recibe el formulario de contacto de **todos**
los sitios de clientes de CRIMSES y lo manda por mail vía [Resend](https://resend.com).
Un solo backend, una sola cuenta de Resend, sirve a todos los clientes
presentes y futuros — reemplaza tener una cuenta de Formspree distinta (y su
límite de 50/mes) por cada sitio.

## Cómo sumar un cliente nuevo

1. Abrir `src/index.js`.
2. Agregar una entrada al objeto `CLIENTS` con el origen exacto del sitio del
   cliente (`https://sudominio.com`, sin `/` al final) y el mail real donde
   quiere recibir los mensajes.
3. Commitear y pushear a `develop`, probar en el Preview, mergear a `main`.

El cliente nunca necesita crear ninguna cuenta ni saber que este Worker
existe — es infraestructura interna de CRIMSES.

## Variables necesarias (secrets de Cloudflare, no van en el código)

- `RESEND_API_KEY`: la API key de la cuenta de Resend de CRIMSES.

## Desde el lado del sitio del cliente

El formulario de contacto tiene que hacer un `fetch` tipo:

```js
fetch("https://crimses-forms.<subdominio-de-cuenta>.workers.dev", {
  method: "POST",
  body: new FormData(form), // necesita los campos name, email, message
})
```

(La URL real del Worker se confirma una vez desplegado — ver `references/05-formulario-contacto.md`
de la skill `crimses-sitio-cliente` para el paso a paso actualizado.)
