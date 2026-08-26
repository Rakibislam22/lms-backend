'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const roleNames = ['content_manager', 'instructor', 'student'];
    for (const name of roleNames) {
      const existing = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: name } });
      if (!existing) {
        await strapi.query('plugin::users-permissions.role').create({
          data: { name, description: `${name} role`, type: name },
        });
        console.log(`Created role: ${name}`);
      }
    }
  },
};
