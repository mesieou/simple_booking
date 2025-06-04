export const createClient = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => ({
          data: null,
          error: null
        })
      })
    }),
    insert: () => ({
      select: () => ({
        single: () => ({
          data: null,
          error: null
        })
      })
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: () => ({
            data: null,
            error: null
          })
        })
      })
    }),
    delete: () => ({
      eq: () => ({
        data: null,
        error: null
      })
    })
  }),
  auth: {
    admin: {
      createUser: () => ({
        data: { user: { id: 'mock-user-id' } },
        error: null
      }),
      deleteUser: () => ({
        data: null,
        error: null
      })
    }
  }
}); 