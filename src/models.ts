import mongoose, { Schema } from 'mongoose';

const rule = new Schema({
  method: { type: String, enum: ['markup', 'margin'], required: true },
  rate: { type: Number, required: true, min: 0, max: 0.99 },
  taxes: [{ name: { type: String, required: true }, rate: { type: Number, required: true, min: 0, max: 1 } }],
}, { _id: false });

export const Supplier = mongoose.model('Supplier', new Schema({
  name: { type: String, required: true, trim: true },
  contact: { type: String, required: true, trim: true },
  channel: { type: String, required: true, trim: true },
}, { timestamps: true }));

export const Department = mongoose.model('Department', new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  pricing: { type: rule, required: true },
}, { timestamps: true }));

export const Product = mongoose.model('Product', new Schema({
  name: { type: String, required: true, trim: true },
  unit: { type: String, required: true, trim: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  pricing: { type: rule, default: undefined },
}, { timestamps: true }));

const requestItem = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.001 },
}, { _id: false });

export const QuoteRequest = mongoose.model('QuoteRequest', new Schema({
  title: { type: String, required: true, trim: true },
  items: { type: [requestItem], required: true, validate: [(v: unknown[]) => v.length > 0, 'Se requiere al menos un producto'] },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true }));

const quoteItem = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.001 },
  unitCost: { type: Number, required: true, min: 0 },
}, { _id: false });

export const Quote = mongoose.model('Quote', new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'QuoteRequest', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: { type: [quoteItem], required: true, validate: [(v: unknown[]) => v.length > 0, 'Se requiere al menos una partida'] },
  extraCharges: { type: Number, min: 0, default: 0 },
  deliveryDays: { type: Number, min: 0, required: true },
  paymentTerms: { type: String, required: true, trim: true },
  sourceChannel: { type: String, required: true, trim: true },
  attachment: { type: String },
  total: { type: Number, required: true, min: 0 },
}, { timestamps: true }));
