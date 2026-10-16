import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Supplier, Department, Product, QuoteRequest, Quote } from './models';
import { calculatePrice, PricingRule } from './pricing';

const app = express();
app.use(express.json());
const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const validId = (id: string) => mongoose.isValidObjectId(id);
const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });
const requireId = (id: string | string[]) => { if (Array.isArray(id) || !validId(id)) throw httpError(400, 'ID inválido'); };
const allowed = (body: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(body).filter(([key]) => keys.includes(key)));
const supplierFields = ['name', 'contact', 'channel'];
const productFields = ['name', 'unit', 'departmentId', 'pricing'];

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/suppliers', asyncRoute(async (req, res) => {
  const supplier = await Supplier.create(allowed(req.body, supplierFields));
  res.status(201).json(supplier);
}));
app.get('/api/suppliers', asyncRoute(async (_req, res) => res.json(await Supplier.find().sort({ name: 1 }))));
app.get('/api/suppliers/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id); const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw httpError(404, 'Proveedor no encontrado'); res.json(supplier);
}));
app.patch('/api/suppliers/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, allowed(req.body, supplierFields), { new: true, runValidators: true });
  if (!supplier) throw httpError(404, 'Proveedor no encontrado'); res.json(supplier);
}));
app.delete('/api/suppliers/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  if (await Quote.exists({ supplierId: req.params.id })) throw httpError(409, 'El proveedor tiene cotizaciones históricas');
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw httpError(404, 'Proveedor no encontrado'); res.status(204).end();
}));

app.post('/api/departments', asyncRoute(async (req, res) => res.status(201).json(await Department.create(allowed(req.body, ['name', 'pricing'])))));
app.get('/api/departments', asyncRoute(async (_req, res) => res.json(await Department.find().sort({ name: 1 }))));
app.patch('/api/departments/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  const department = await Department.findByIdAndUpdate(req.params.id, allowed(req.body, ['name', 'pricing']), { new: true, runValidators: true });
  if (!department) throw httpError(404, 'Departamento no encontrado'); res.json(department);
}));

app.post('/api/products', asyncRoute(async (req, res) => {
  if (!validId(req.body.departmentId) || !await Department.exists({ _id: req.body.departmentId })) throw httpError(404, 'Departamento no encontrado');
  res.status(201).json(await Product.create(allowed(req.body, productFields)));
}));
app.get('/api/products', asyncRoute(async (_req, res) => res.json(await Product.find().populate('departmentId', 'name').sort({ name: 1 }))));
app.get('/api/products/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id); const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Producto no encontrado'); res.json(product);
}));
app.patch('/api/products/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  if (req.body.departmentId && (!validId(req.body.departmentId) || !await Department.exists({ _id: req.body.departmentId }))) throw httpError(404, 'Departamento no encontrado');
  const product = await Product.findByIdAndUpdate(req.params.id, allowed(req.body, productFields), { new: true, runValidators: true });
  if (!product) throw httpError(404, 'Producto no encontrado'); res.json(product);
}));
app.delete('/api/products/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  if (await QuoteRequest.exists({ 'items.productId': req.params.id })) throw httpError(409, 'El producto tiene historial de solicitudes');
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw httpError(404, 'Producto no encontrado'); res.status(204).end();
}));
app.get('/api/products/:id/price', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  const cost = Number(req.query.cost);
  if (req.query.cost === undefined || !Number.isFinite(cost) || cost < 0) throw httpError(400, 'Costo inválido');
  const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Producto no encontrado');
  const department = await Department.findById(product.departmentId);
  if (!department) throw httpError(409, 'El producto no tiene departamento válido');
  const selected = product.pricing ?? department.pricing;
  const rule: PricingRule = { method: selected.method, rate: selected.rate, taxes: selected.taxes.map(tax => ({ name: tax.name, rate: tax.rate })) };
  res.json({ productId: product.id, source: product.pricing ? 'product' : 'department', ...calculatePrice(cost, rule) });
}));

app.post('/api/quote-requests', asyncRoute(async (req, res) => {
  if (!Array.isArray(req.body.items) || !req.body.items.length) throw httpError(400, 'Se requieren productos');
  const ids = req.body.items.map((item: { productId: string }) => item.productId);
  if (new Set(ids).size !== ids.length || ids.some((id: string) => !validId(id))) throw httpError(400, 'Productos duplicados o inválidos');
  if (await Product.countDocuments({ _id: { $in: ids } }) !== ids.length) throw httpError(404, 'Producto no encontrado');
  res.status(201).json(await QuoteRequest.create(allowed(req.body, ['title', 'items'])));
}));
app.get('/api/quote-requests', asyncRoute(async (_req, res) => res.json(await QuoteRequest.find().sort({ createdAt: -1 }))));
app.get('/api/quote-requests/:id', asyncRoute(async (req, res) => {
  requireId(req.params.id); const request = await QuoteRequest.findById(req.params.id);
  if (!request) throw httpError(404, 'Solicitud no encontrada'); res.json(request);
}));
app.post('/api/quote-requests/:id/quotes', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  const request = await QuoteRequest.findById(req.params.id);
  if (!request) throw httpError(404, 'Solicitud no encontrada');
  if (request.status !== 'open') throw httpError(409, 'La solicitud está cerrada');
  if (!validId(req.body.supplierId) || !await Supplier.exists({ _id: req.body.supplierId })) throw httpError(404, 'Proveedor no encontrado');
  const items = req.body.items as { productId: string; quantity: number; unitCost: number }[];
  if (!Array.isArray(items) || items.length !== request.items.length) throw httpError(400, 'Las partidas no corresponden a la solicitud');
  const expected = new Map(request.items.map(item => [String(item.productId), item.quantity]));
  if (new Set(items.map(item => item.productId)).size !== items.length || items.some(item => !expected.has(item.productId) || expected.get(item.productId) !== item.quantity || !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
    throw httpError(400, 'Las partidas no corresponden a la solicitud');
  }
  const extraCharges = req.body.extraCharges ?? 0;
  if (!Number.isFinite(extraCharges) || extraCharges < 0) throw httpError(400, 'Cargos adicionales inválidos');
  const total = Math.round((items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) + extraCharges + Number.EPSILON) * 100) / 100;
  const quote = await Quote.create({ ...allowed(req.body, ['supplierId', 'items', 'extraCharges', 'deliveryDays', 'paymentTerms', 'sourceChannel']), requestId: request.id, total });
  res.status(201).json(quote);
}));
app.get('/api/quote-requests/:id/comparison', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  const request = await QuoteRequest.findById(req.params.id);
  if (!request) throw httpError(404, 'Solicitud no encontrada');
  const quotes = await Quote.find({ requestId: request.id }).populate('supplierId', 'name').sort({ total: 1, deliveryDays: 1 });
  res.json({ requestId: request.id, title: request.title, quotes, lowestPriceQuoteId: quotes[0]?.id ?? null, note: 'La recomendación considera el precio total; revisa también entrega y pago.' });
}));

const uploadDir = path.join(process.cwd(), 'uploads');
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => { fs.mkdirSync(uploadDir, { recursive: true }); cb(null, uploadDir); }, filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'text/csv', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype)),
});
app.post('/api/quotes/:id/attachment', upload.single('file'), asyncRoute(async (req, res) => {
  requireId(req.params.id);
  if (!req.file) throw httpError(400, 'Archivo requerido: PDF, CSV, XLSX, JPG o PNG (máximo 5 MB)');
  const quote = await Quote.findByIdAndUpdate(req.params.id, { attachment: req.file.filename }, { new: true });
  if (!quote) { fs.unlinkSync(req.file.path); throw httpError(404, 'Cotización no encontrada'); }
  res.json({ quoteId: quote.id, attachment: quote.attachment });
}));
app.get('/api/quotes/:id/attachment', asyncRoute(async (req, res) => {
  requireId(req.params.id);
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw httpError(404, 'Cotización no encontrada');
  if (!quote.attachment) throw httpError(404, 'La cotización no tiene adjunto');
  res.download(path.join(uploadDir, path.basename(quote.attachment)));
}));

app.use((error: Error & { status?: number; code?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const status = error.status ?? (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'MulterError' ? 400 : error.code === 11000 ? 409 : 500);
  res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : error.message });
});

export default app;
