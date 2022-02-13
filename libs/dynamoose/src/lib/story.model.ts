import {Story} from "@bobs-bedtime-stories/shared";
import {model, Schema} from "dynamoose";
import {Document} from "dynamoose/dist/Document";

export class StoryDocument extends Document implements Story {
  bookSlug!: string;
  audioS3Key!: string;
  date!: Date;
  description?: string;
  episode!: number;
  externalLinks?: string[];
  imageUrls?: string[];
  videoUrls?: string[];
}

export const StoryTableName = process.env.DYNAMO_TABLE_stories;

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
  audioS3Key: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  externalLinks: {
    type: [String],
    required: false,
  },
  imageUrls: {
    type: [String],
    required: false,
  },
  videoUrls: {
    type: [String],
    required: false,
  },
});

export const makeStoryModel = () => model<StoryDocument>(StoryTableName, StorySchema, {
  create: false,
  update: false,
});
