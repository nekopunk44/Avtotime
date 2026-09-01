import mongoose from "mongoose";


const storySchema= new mongoose.Schema({
    author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            mediaType: {
                type: String,
                enum: ['image', 'video'],
                required: true,
            },
            media: {
                type: String,
                required: true,
            },
            viewers: [
                {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                }
            ],
            createdAt: {
                type: Date,
                // Must be the function reference, not a call: Date.now() would be
                // evaluated once at process start, giving every story the same
                // createdAt and making the TTL index expire new stories instantly
                // after a day of uptime.
                default: Date.now,
                expires:86400,
            }
}, {timestamps:true,})

// Both story queries filter by author; without this they scan the collection.
storySchema.index({ author: 1, createdAt: -1 })

const Story = mongoose.model('Story', storySchema)
export default Story