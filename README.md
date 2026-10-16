# PROVEr

Backend para que una PYME registre proveedores, configure precios de venta y compare cotizaciones recibidas por diferentes canales. Primera versión del proyecto integrador TDS, Otoño 2026.

## Requisitos

Node.js 20+, npm, MongoDB 7 (o Docker). Los datos de cotizaciones se capturan manualmente; el adjunto se guarda localmente en `uploads/`. No se extraen datos automáticamente del archivo.

## Inicio rápido

1. `npm install`
2. Copiar `.env.example` a `.env` y ajustar `MONGODB_URI` si hace falta.
3. Iniciar MongoDB (`docker compose up -d mongodb` si usas Docker).
4. `npm run dev`
5. Probar `GET http://localhost:3000/api/health`.

Para compilar: `npm run build`; para ejecutar el compilado: `npm start`; para pruebas de cálculo: `npm test`.

## Flujo mínimo para demostrar las tres features

1. `POST /api/suppliers` con `{"name":"Distribuidora Centro","contact":"compras@ejemplo.mx","channel":"correo"}`.
2. `POST /api/departments` con `{"name":"Bebidas","pricing":{"method":"markup","rate":0.3,"taxes":[]}}`.
3. `POST /api/products` con `{"name":"Bebida 1 L","unit":"pieza","departmentId":"<id departamento>"}`.
4. `GET /api/products/<id producto>/price?cost=100` devuelve subtotal 130 antes de impuestos.
5. `POST /api/quote-requests` con `{"title":"Compra semanal","items":[{"productId":"<id producto>","quantity":10}]}`.
6. Crear dos proveedores y dos cotizaciones con `POST /api/quote-requests/<id solicitud>/quotes`. Cuerpo: `{"supplierId":"<id proveedor>","items":[{"productId":"<id producto>","quantity":10,"unitCost":100}],"extraCharges":0,"deliveryDays":2,"paymentTerms":"Contado","sourceChannel":"correo"}`.
7. `GET /api/quote-requests/<id solicitud>/comparison` ordena ofertas por total y muestra condiciones.

`POST /api/quotes/<id cotización>/attachment` acepta `multipart/form-data` con campo `file` (PDF, CSV, XLSX, JPG o PNG; 5 MB). `GET /api/quotes/<id cotización>/attachment` lo descarga. El archivo sirve como evidencia, sin lectura automática. `examples/cotizacion-ejemplo.csv` es un archivo de prueba.

## Arquitectura y alcance

`src/app.ts` contiene rutas y controladores HTTP; `src/models.ts` define los modelos Mongoose; `src/pricing.ts` contiene la regla de negocio de precios; `src/server.ts` conecta MongoDB e inicia Express. La API responde JSON y usa 400, 404, 409 y 500 según el error. Los IDs son ObjectId de MongoDB.

Esta versión está pensada para demostración local de una sola empresa. Aún no hay autenticación ni aislamiento entre empresas: no debe exponerse públicamente como servicio real. Google Auth, API REST externa, sockets, almacenamiento de archivos en la nube, pruebas de integración, CI/CD y despliegue forman parte de las siguientes entregas del proyecto completo. Los impuestos son configurados por el usuario y el cálculo no representa asesoría fiscal.

## Uso de IA

Se utilizó Codex (OpenAI) para apoyar la estructura del backend, el diseño de endpoints y la redacción inicial de pruebas y documentación, a partir de la guía TDS y decisiones del estudiante. El estudiante debe revisar, ejecutar y comprender el código antes de entregarlo.
