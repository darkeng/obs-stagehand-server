const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'video', 'audio'], required: true },
  name: { type: String, default: '' },
  content: { type: String, default: '' },
  x_pc: { type: Number, default: 0 },
  y_pc: { type: Number, default: 0 },
  width_pc: { type: Number, default: 40 },
  height_pc: { type: Number, default: 40 },
  zIndex: { type: Number, default: 1 },
  visible: { type: Boolean, default: false },
  fontFamily: { type: String, default: 'Inter' },
  fontColor: { type: String, default: '#ffffff' },
  strokeColor: { type: String, default: '#000000' },
  strokeWidth: { type: Number, default: 2 },
  playing: { type: Boolean, default: false },
  loop: { type: Boolean, default: true },
  volume: { type: Number, default: 1 },
  mask_enabled: { type: Boolean, default: false },
  mask_shape: { type: String, enum: ['inset', 'ellipse'], default: 'inset' },
  mask_top_pc: { type: Number, default: 0 },
  mask_right_pc: { type: Number, default: 0 },
  mask_bottom_pc: { type: Number, default: 0 },
  mask_left_pc: { type: Number, default: 0 },
  mask_round_pc: { type: Number, default: 0 }
}, { _id: false });

const SceneSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Untitled Scene' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestId: { type: String, default: null },
  shareToken: { type: String, required: true, unique: true },
  elements: [ElementSchema],
  createdAt: { type: Date, default: Date.now }
});

SceneSchema.index({ owner: 1, createdAt: -1 });
SceneSchema.index({ guestId: 1, createdAt: -1 });

SceneSchema.pre('validate', function () {
  const hasOwner = !!this.owner;
  const hasGuest = !!this.guestId;
  if (hasOwner === hasGuest) {
    this.invalidate('owner', 'Scene must have exactly one of owner or guestId');
  }
});

SceneSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Scene', SceneSchema);
