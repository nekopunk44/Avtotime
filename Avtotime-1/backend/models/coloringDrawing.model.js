import mongoose from 'mongoose';

const coloringDrawingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  templateId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  imageData: {
    type: String, // Base64 encoded image
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  brushSize: {
    type: Number,
    default: 20
  },
  colorsUsed: [{
    type: String,
    default: []
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

coloringDrawingSchema.index({ userId: 1, templateId: 1 });
coloringDrawingSchema.index({ createdAt: -1 });

const ColoringDrawing = mongoose.model('ColoringDrawing', coloringDrawingSchema);

export default ColoringDrawing;
