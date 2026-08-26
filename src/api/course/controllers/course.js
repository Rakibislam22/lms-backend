const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::course.course', ({ strapi }) => ({
    async update(ctx) {
        const course = await strapi.entityService.findOne('api::course.course', ctx.params.id, { populate: ['owner'] });
        const user = ctx.state.user;
        if (user.role.type === 'instructor' && course.owner?.id !== user.id) {
            return ctx.forbidden('You can only edit your own courses');
        }
        return super.update(ctx);
    },
    async delete(ctx) {
        const course = await strapi.entityService.findOne('api::course.course', ctx.params.id, { populate: ['owner'] });
        const user = ctx.state.user;
        if (user.role.type === 'instructor' && course.owner?.id !== user.id) {
            return ctx.forbidden('You can only delete your own courses');
        }
        return super.delete(ctx);
    },
}));
