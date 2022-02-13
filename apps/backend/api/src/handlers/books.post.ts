import {makeBookModel} from '@bobs-bedtime-stories/dynamoose';
import {wrapApiHandler} from '../utils/wrap-api-handler';
import {Book} from "@bobs-bedtime-stories/shared";
import * as makeSlug from 'slug';
import {Condition} from "dynamoose/dist/Condition";

export const postBook = wrapApiHandler(async (event) => {
  const body = JSON.parse(event.body ?? '{}');

  const slug = makeSlug(body.title);

  return await makeBookModel().create({
    title: body.title,
    description: body.description,
    slug,
  } as Book, {
    condition: new Condition().attribute('slug').not().eq(slug)
  });
});
