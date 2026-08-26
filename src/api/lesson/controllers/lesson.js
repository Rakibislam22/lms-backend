'use strict';

/**
 * lesson controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::lesson.lesson', ({ strapi }) => ({
  async isCourseOwner(ctx, lesson) {
    if (await isContentManagerOrAdmin(strapi, ctx.state.user)) return true;
    const courseId = lesson?.course?.id ?? ctx.request.body?.data?.course;
    if (!courseId) return false;
    const course = await strapi.db.query('api::course.course').findOne({
      where: { id: courseId },
      populate: ['owner'],
    });
    return course?.owner?.id === ctx.state.user.id;
  },
  async create(ctx) {
    ctx.request.body = ctx.request.body || {};
    const allowed = await this.isCourseOwner(ctx);
    if (!allowed) return ctx.forbidden('You can only manage lessons in your own courses');
    return super.create(ctx);
  },
  async update(ctx) {
    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { id: ctx.params.id },
      populate: ['course'],
    });
    if (!lesson) return ctx.notFound('Lesson not found');
    const allowed = await this.isCourseOwner(ctx, lesson);
    if (!allowed) return ctx.forbidden('You can only manage lessons in your own courses');
    return super.update(ctx);
  },
  async delete(ctx) {
    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { id: ctx.params.id },
      populate: ['course'],
    });
    if (!lesson) return ctx.notFound('Lesson not found');
    const allowed = await this.isCourseOwner(ctx, lesson);
    if (!allowed) return ctx.forbidden('You can only manage lessons in your own courses');
    return super.delete(ctx);
  },
}));
