<template>
  <div class="home-page">
    <section class="hero-stage">
      <div class="hero-banner">
        <div class="hero-banner__copy">
          <p class="hero-banner__eyebrow">Kitchen planning for everyday life</p>
          <h1 class="hero-banner__title">
            {{ SITE_HOME_CONFIG.heroTitleLead }}
            <span>{{ SITE_HOME_CONFIG.heroTitleHighlight }}</span>
            {{ SITE_HOME_CONFIG.heroTitleTail }}
          </h1>
          <p class="hero-banner__text">{{ SITE_HOME_CONFIG.heroSummary }}</p>

          <div class="hero-banner__actions">
            <RouterLink class="primary-link" :to="SITE_HOME_CONFIG.primaryCta.to">{{ SITE_HOME_CONFIG.primaryCta.label }}</RouterLink>
            <RouterLink class="ghost-link" :to="SITE_HOME_CONFIG.secondaryCta.to">{{ SITE_HOME_CONFIG.secondaryCta.label }}</RouterLink>
          </div>

          <div class="hero-banner__note">
            <i />
            {{ SITE_HOME_CONFIG.heroNote }}
          </div>
        </div>

        <div class="hero-banner__visual">
          <div class="hero-banner__backdrop hero-banner__backdrop--lime" />
          <div class="hero-banner__backdrop hero-banner__backdrop--cream" />
          <div class="hero-banner__backdrop hero-banner__backdrop--warm" />

          <img class="hero-banner__asset hero-banner__asset--plate" :src="heroPlateSrc" alt="食材主盘" />
          <img class="hero-banner__asset hero-banner__asset--dip" :src="heroDipSrc" alt="蘸碟" />
          <img class="hero-banner__asset hero-banner__asset--sticks" :src="heroSticksSrc" alt="筷子" />
          <img class="hero-banner__asset hero-banner__asset--produce" :src="heroProduceSrc" alt="蔬果食材" />

          <div class="hero-banner__float hero-banner__float--top-left">{{ SITE_HOME_CONFIG.visualTags[0] }}</div>
          <div class="hero-banner__float hero-banner__float--top-right">{{ SITE_HOME_CONFIG.visualTags[1] }}</div>
          <div class="hero-banner__float hero-banner__float--bottom-left">{{ SITE_HOME_CONFIG.visualTags[2] }}</div>
          <div class="hero-banner__float hero-banner__float--bottom-right">{{ SITE_HOME_CONFIG.visualTags[3] }}</div>
        </div>
      </div>

      <div class="prep-strip">
        <article v-for="step in SITE_PLAN_STEPS" :key="step.index" class="prep-step">
          <span class="prep-step__index">{{ step.index }}</span>
          <strong>{{ step.title }}</strong>
          <p>{{ step.summary }}</p>
        </article>
      </div>

      <div class="ingredient-ribbon">
        <span v-for="item in SITE_INGREDIENT_RIBBON" :key="item" class="ingredient-ribbon__item">
          <i class="ingredient-ribbon__seed" />
          {{ item }}
        </span>
      </div>
    </section>

    <section class="guide-grid">
      <div class="section-heading">
        <h2>{{ SITE_HOME_CONFIG.guideTitle }}</h2>
      </div>

      <div class="guide-grid__list">
        <RouterLink v-for="guide in SITE_GUIDE_LINKS" :key="guide.title" class="guide-tile" :to="guide.path">
          <span class="guide-tile__icon">
            <img :src="guide.icon" :alt="guide.title" />
          </span>
          <div class="guide-tile__copy">
            <strong>{{ guide.title }}</strong>
            <p>{{ guide.summary }}</p>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="content-rail">
      <div class="content-rail__lead">
        <h2>{{ SITE_HOME_CONFIG.contentTitle }}</h2>
        <p>{{ SITE_HOME_CONFIG.contentSummary }}</p>
      </div>

      <div class="content-rail__list">
        <RouterLink v-for="doc in featuredDocs" :key="doc.slug" class="content-link" :to="doc.path">
          <span class="content-link__label">{{ doc.label }}</span>
          <strong>{{ doc.title }}</strong>
          <span class="content-link__meta">{{ doc.summary }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import heroDipSrc from "@/assets/img/hero-dip.png";
import heroPlateSrc from "@/assets/img/hero-plate.png";
import heroProduceSrc from "@/assets/img/hero-produce.png";
import heroSticksSrc from "@/assets/img/hero-sticks.png";
import { SITE_GUIDE_LINKS, SITE_HOME_CONFIG, SITE_INGREDIENT_RIBBON, SITE_PLAN_STEPS } from "@/config/app";
import { docsBySlug } from "@/content/docs";

const featuredDocs = computed(() =>
  [...SITE_HOME_CONFIG.featuredDocSlugs]
    .map((slug) => docsBySlug.get(slug))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
);
</script>
