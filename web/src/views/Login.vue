<template>
  <v-sheet class="bg-deep-purple pa-12" rounded>
    <v-card class="mx-auto px-6 py-8" max-width="344">
      <v-form
        v-model="form"
        @submit.prevent="onSubmit"
      >
        <v-text-field
          v-model="username"
          :readonly="loading"
          :rules="[required]"
          class="mb-2"
          clearable
          label="Username"
        ></v-text-field>

        <v-text-field
          v-model="password"
          :readonly="loading"
          :rules="[required]"
          clearable
          label="Password"
          placeholder="Enter your password"
        ></v-text-field>

        <br>

        <v-btn
          :disabled="!form"
          :loading="loading"
          block
          color="success"
          size="large"
          type="submit"
          variant="elevated"
        >
          Sign In
        </v-btn>
      </v-form>
      <v-snackbar v-model="snackbar"  :timeout="timeout" :color="color">
        {{ snackbarText }}
      </v-snackbar>
    </v-card>
  </v-sheet>
</template>
  
  <script>
  import axios from 'axios';
  import { router } from '@/router/index'

  export default {
    data() {
      return {
        username: undefined,
        password: undefined,
        form: false,
        loading: false,
        snackbar: false,
        timeout: 3000,
        color: "",
        snackbarText: "",
      };
    },
    methods: {
      required (v) {
        return !!v || 'Field is required'
      },
      onSubmit() {
        if (!this.form) return
        this.loading = true

        axios.post('http://localhost:4000/login', {
        username: this.username,
        password: this.password
      })
      .then(response => {
        const token = response.data;
        localStorage.setItem('thunes_token', token); // store the token in localStorage
        router.push('/');
      })
      .catch(error => {
        if (error.response.status !== 200) {
          this.snackbar = true;
          this.color = 'red';

          if (error.response.status === 401) {
            this.snackbarText = "Invalid Credentials"
          }

          if (error.response.status === 500) {
            this.snackbarText = "Internal Server Error"
          }
        }
      });
      this.loading = false;
      },
    },
  };
  </script>
  
  
  