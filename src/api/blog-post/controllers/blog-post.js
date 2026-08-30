'use strict';

/**
 * blog-post controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getRoleType, isContentManagerOrAdmin } = require('../../../utils/access');

module.exports = createCoreController('api::blog-post.blog-post', ({ strapi }) => ({
    async find(ctx) {
        const role = await getRoleType(strapi, ctx.state.user);
        const canViewDrafts = role === 'admin' || role === 'content_manager';

        // Only published posts are visible to students and the public; drafts are not
        if (!canViewDrafts) {
            ctx.query = ctx.query || {};
            ctx.query.filters = {
                ...(ctx.query.filters || {}),
                status: { $eq: 'published' },
            };
        }

        return super.find(ctx);
    },
    async findOne(ctx) {
        const isNumeric = !isNaN(Number(ctx.params.id));
        const whereClause = isNumeric
            ? { id: Number(ctx.params.id) }
            : { documentId: ctx.params.id };

        const post = await strapi.db.query('api::blog-post.blog-post').findOne({
            where: whereClause,
            populate: ['author'],
        });
        if (!post) return ctx.notFound('Blog post not found');

        const role = await getRoleType(strapi, ctx.state.user);
        const isAuthor = post.author?.id === ctx.state.user?.id;
        const canViewDraft = role === 'admin' || role === 'content_manager' || isAuthor;

        if (post.status !== 'published' && !canViewDraft) {
            return ctx.notFound('Blog post not found');
        }

        ctx.params.id = post.documentId || post.id;
        return super.findOne(ctx);
    },
    async create(ctx) {
        ctx.request.body = ctx.request.body || {};
        const role = await getRoleType(strapi, ctx.state.user);
        if (role !== 'admin') {
            ctx.request.body.data = {
                ...(ctx.request.body.data || {}),
                author: ctx.state.user.id,
            };
        }
        return super.create(ctx);
    },
    async update(ctx) {
        const isNumeric = !isNaN(Number(ctx.params.id));
        const whereClause = isNumeric
            ? { id: Number(ctx.params.id) }
            : { documentId: ctx.params.id };

        const post = await strapi.db.query('api::blog-post.blog-post').findOne({
            where: whereClause,
            populate: ['author'],
        });
        if (!post) return ctx.notFound('Blog post not found');

        const role = await getRoleType(strapi, ctx.state.user);
        if (role !== 'admin' && post.author?.id !== ctx.state.user.id) {
            return ctx.forbidden('You can only edit your own posts');
        }
        ctx.params.id = post.documentId || post.id;
        return super.update(ctx);
    },
    async delete(ctx) {
        const isNumeric = !isNaN(Number(ctx.params.id));
        const whereClause = isNumeric
            ? { id: Number(ctx.params.id) }
            : { documentId: ctx.params.id };

        const post = await strapi.db.query('api::blog-post.blog-post').findOne({
            where: whereClause,
            populate: ['author'],
        });
        if (!post) return ctx.notFound('Blog post not found');

        const role = await getRoleType(strapi, ctx.state.user);
        if (role !== 'admin' && post.author?.id !== ctx.state.user.id) {
            return ctx.forbidden('You can only delete your own posts');
        }
        ctx.params.id = post.documentId || post.id;
        return super.delete(ctx);
    },
}));
