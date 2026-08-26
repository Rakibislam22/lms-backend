'use strict';

/**
 * blog-post router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const allow = (roles) => [{ name: 'global::has-role', config: { roles } }];
module.exports = createCoreRouter('api::blog-post.blog-post', {
  config: {
    find: { policies: allow(['admin', 'content_manager', 'instructor', 'student', 'public']) },
    findOne: { policies: allow(['admin', 'content_manager', 'instructor', 'student', 'public']) },
    create: { policies: allow(['admin', 'content_manager']) },
    update: { policies: allow(['admin', 'content_manager']) },
    delete: { policies: allow(['admin', 'content_manager']) },
  },
});
