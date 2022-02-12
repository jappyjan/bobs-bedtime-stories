import {Story} from "@bobs-bedtime-stories/shared";
import {model, Schema} from "dynamoose";
import {Document} from "dynamoose/dist/Document";

export class StoryDocument extends Document implements Story {
  bookSlug!: string;
  audioLength!: number;
  audioUrl!: string;
  date!: string;
  description!: string;
  episode!: number;
  externalLinks!: string[];
  imageUrls!: string[];
  videoUrls!: string[];
}

export const StoryTableName = 'stories';

export const StorySchema = new Schema({
  bookSlug: {
    type: String,
    required: true,
    hashKey: true,
  },
  episode: {
    type: Number,
    required: true,
    rangeKey: true,
  },
  audioLength: {
    type: Number,
    required: true,
  },
  audioUrl: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  externalLinks: {
    type: [String],
  },
  imageUrls: {
    type: [String],
  },
  videoUrls: {
    type: [String],
  },
});

export const StoryModel = model<StoryDocument>(StoryTableName, StorySchema, {
  create: true,
  update: true,
});
