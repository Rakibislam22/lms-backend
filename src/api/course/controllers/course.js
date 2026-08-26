const { createCoreController } = require('@strapi/strapi').factories;
const { isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::course.course', ({ strapi }) => ({
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        if (!(await isContentManagerOrAdmin(strapi, ctx.state.user))) {
            ctx.request.body.data = {
                ...(ctx.request.body.data || {}),
                owner: ctx.state.user.id,
            };
        }
        return super.create(ctx);
    },
    async update(ctx) {
        const course = await strapi.db.query('api::course.course').findOne({
            where: { id: ctx.params.id },
            populate: ['owner'],
        });
        if (!course) return ctx.notFound('Course not found');
        const user = ctx.state.user;
        if (!(await isContentManagerOrAdmin(strapi, user)) && course?.owner?.id !== user.id) {
            return ctx.forbidden('You can only edit your own courses');
        }
        return super.update(ctx);
    },
    async delete(ctx) {
        const course = await strapi.db.query('api::course.course').findOne({
            where: { id: ctx.params.id },
            populate: ['owner'],
        });
        if (!course) return ctx.notFound('Course not found');
        const user = ctx.state.user;
        if (!(await isContentManagerOrAdmin(strapi, user)) && course?.owner?.id !== user.id) {
            return ctx.forbidden('You can only delete your own courses');
        }
        return super.delete(ctx);
    },
}));
