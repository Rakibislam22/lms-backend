const { createCoreRouter } = require('@strapi/strapi').factories;
const allow = (roles) => [{ name: 'global::has-role', config: { roles } }];
module.exports = createCoreRouter('api::course.course', {
  config: {
    find: { policies: allow(['admin', 'content_manager', 'instructor', 'student', 'public']) },
    findOne: { policies: allow(['admin', 'content_manager', 'instructor', 'student', 'public']) },
    create: { policies: allow(['admin', 'content_manager', 'instructor']) },
    update: { policies: allow(['admin', 'content_manager', 'instructor']) },
    delete: { policies: allow(['admin', 'content_manager', 'instructor']) },
  },
});
