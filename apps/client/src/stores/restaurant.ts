import { defineStore } from "pinia";
import type { RestaurantSummary, UUID } from "@next-meal/api-client";

export const useRestaurantStore = defineStore("restaurant", {
  state: () => ({
    currentRestaurantId: "" as UUID | "",
    restaurants: [] as RestaurantSummary[]
  }),
  getters: {
    currentRestaurant: (state) => state.restaurants.find((item) => item.id === state.currentRestaurantId) ?? null
  },
  actions: {
    setRestaurants(restaurants: RestaurantSummary[], currentRestaurantId: UUID | null) {
      this.restaurants = restaurants;
      this.currentRestaurantId = currentRestaurantId ?? restaurants[0]?.id ?? "";
    },
    switchRestaurant(restaurantId: UUID) {
      this.currentRestaurantId = restaurantId;
    },
    clearRestaurantState() {
      this.currentRestaurantId = "";
      this.restaurants = [];
    }
  }
});
