<template>
  <v-sheet class="bg-deep-purple pa-12" rounded>
    <v-card class="mx-auto px-6 py-8" max-width="1500">
      <div class="content">
    <!-- <button type="button" class="btn btn-sm btn-outline-success" v-on:click="fetchAllData">LOAD ALL</button> -->

      <h1>Hello {{name}}, you have {{balance}} currency !</h1>

      <v-divider></v-divider>

      <v-form
        v-model="form"
        @submit.prevent="onSubmit"
      >

        Destination: <select v-model="destination" :readonly="loading" :rules="[required]" class="pa-2 mb-2 w-66" label="Destination" id="destination">
          <option v-for="user in users" :value="user.id">
            {{ user.username }}
          </option>
        </select>

      <v-divider></v-divider>

        <v-text-field
          v-model.number="amount"
          :readonly="loading"
          :rules="[required]"
          class="mb-2 w-66"
          clearable
          size="medium"
          label="Amount"
        ></v-text-field>
        <v-btn
          :disabled="!form"
          :loading="loading"
          block
          color="success"
          size="medium"
          type="submit"
          variant="elevated"
        >
          Transfer Currency
        </v-btn>
      </v-form>
      <v-snackbar v-model="snackbar"  :timeout="timeout" :color="color">
        {{ snackbarText }}
      </v-snackbar>

      <v-divider></v-divider>

        <h1>list of users</h1>
        <table class="table">
          <thead>
            <tr>
            <th>NAME</th>
            <th>ID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in users" :key="item.username">
            <td>{{ item.username }}</td>
            <td>{{ item.id }}</td>
            </tr>
          </tbody>
        </table>
      <v-divider></v-divider>
        <h1>list of transfers</h1>
        <table class="table">
          <thead>
            <tr>
            <th>SOURCE</th>
            <th>DESTINATION</th>
            <th>AMOUNT</th>
            <th>DATE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in transfers" :key="item.execution_date">
            <td>{{ item.source }}</td>
            <td>{{ item.destination }}</td>
            <td>{{ item.amount }}</td>
            <td>{{ item.execution_date }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </v-card>
  </v-sheet>
</template>

<script>
import axios from 'axios'
import { router } from '@/router/index'

export default {

  data() {
    return {
      users: [],
      transfers: [],
      name: "placeholder",
      balance: 0,
      form: false,
      loading: false,
      snackbar: false,
      timeout: 3000,
      color: "",
      snackbarText: "",
      destination: 0,
      amount: 0
    }
  },

  methods: {
    fetchAllUsers: function () {
      let token = localStorage.getItem('thunes_token');
      axios.get('http://localhost:4000/users', { headers: {"Authorization" : `Bearer ${token}`} }).then( resp => {
        this.users = []
        resp.data.forEach( x => this.users.push(x))
        this.destination = resp.data[0].id
      }).catch(()=> { console.log('--- ERROR USERS ---') })
    },
    fetchAllTransfers: function () {
      let token = localStorage.getItem('thunes_token');
      axios.get('http://localhost:4000/transfers', { headers: {"Authorization" : `Bearer ${token}`} }).then( resp => {
        this.transfers = []
        resp.data.forEach( x => this.transfers.push(x))
      }).catch(()=> { console.log('--- ERROR TRANSFERS ---') })
    },
    fetchMe: function () {
      let token = localStorage.getItem('thunes_token');
      axios.get('http://localhost:4000/me', { headers: {"Authorization" : `Bearer ${token}`} }).then( resp => {
        this.name = resp.data.username
        this.balance = resp.data.balance
      }).catch(error => {
        console.log('--- ERROR ME ---')
          if (error.response.status === 401) {
            this.snackbarText = "Unauthorized"
	  	      router.push('/login');
          }
      })
    },
    required (v) {
      return !!v || 'Field is required'
    },
    onSubmit() {
      if (!this.form) return
      this.loading = true

      let token = localStorage.getItem('thunes_token');

      axios.post('http://localhost:4000/transfers', {
        destination_id: this.destination,
        amount: this.amount,
      }, {
        headers: {"Authorization" : `Bearer ${token}`}
      })
      .then(response => {
        this.fetchAllTransfers()
        this.fetchMe()
      })
      .catch(error => {
        if (error.response.status !== 200) {
          this.snackbar = true;
          this.color = 'red';

          if (error.response.status === 401) {
            this.snackbarText = "Unauthorized"
	  	      router.push('/login');
          }

          if (error.response.status === 500) {
            //primitive i19n
            let code = error.response.data
            if (code == "transfer_to_itself") {
              this.snackbarText = "Can't transfer to yourself"
            } else if (code == "not_enough_money") {
              this.snackbarText = "Insufficient funds"
            } else if (code == "negative_nul_amount") {
              this.snackbarText = "Must transfer a positive amount of currency"
            } else {
              this.snackbarText = "Internal Server Error"
            }
          }
        }
      });
      this.loading = false;
    },
  },
  beforeMount() {
     this.fetchAllUsers()
     this.fetchAllTransfers()
     this.fetchMe()
  },
};
</script>
