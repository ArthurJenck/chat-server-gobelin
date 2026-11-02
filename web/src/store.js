import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null,
    isAuthenticated: false
  },
  mutations: {
    setUser(state, user) {
      state.user = user
      state.isAuthenticated = !!user
    }
  },
  actions: {
    login({ commit }, credentials) {
      // Call your API or backend service to authenticate the user
      // and get a token in response.
      // Here, we'll assume that the token is returned in a variable
      // called `token`.
      const token = 'my_auth_token'

      // Save the token in local storage so that it persists across page refreshes.
      localStorage.setItem('authToken', token)

      // Set the user in the store.
      commit('setUser', { username: credentials.username })
    },
    logout({ commit }) {
      // Remove the token from local storage.
      localStorage.removeItem('authToken')

      // Set the user to null in the store.
      commit('setUser', null)
    }
  }
})
