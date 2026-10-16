import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app';

const port = Number(process.env.PORT ?? 3000);
const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/prover';

mongoose.connect(uri).then(() => {
  app.listen(port, () => console.log(`PROVEr: http://localhost:${port}`));
}).catch(error => {
  console.error('No se pudo conectar a MongoDB:', error);
  process.exitCode = 1;
});
