'use strict';

/**
 * quiz router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const allow = (roles) => [{ name: 'global::has-role', config: { roles } }];
module.exports = createCoreRouter('api::quiz.quiz', {
  config: {
    find: { policies: allow(['admin', 'content_manager', 'instructor', 'student']) },
    findOne: { policies: allow(['admin', 'content_manager', 'instructor', 'student']) },
    create: { policies: allow(['admin', 'content_manager', 'instructor']) },
    update: { policies: allow(['admin', 'content_manager', 'instructor']) },
    delete: { policies: allow(['admin', 'content_manager', 'instructor']) },
  },
});
