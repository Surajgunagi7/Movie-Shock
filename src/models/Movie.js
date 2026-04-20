import mongoose from 'mongoose';

const MovieSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  year: { type: String },
  poster_path: { type: String },
  franchise: { type: String, required: true },
  type: { type: String, enum: ['movie', 'tv'], required: true },
  added_date: { type: String, required: true },
  overview: { type: String }
});

export default mongoose.models.Movie || mongoose.model('Movie', MovieSchema);
