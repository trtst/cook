<template>
  <div ref="pageRef" class="narrative-home">
    <section class="story-section story-section--hero js-story-section">
      <div class="story-stage hero-scene">
        <div class="hero-scene__copy">
          <p class="story-eyebrow">{{ SITE_HOME_CONFIG.heroEyebrow }}</p>
          <h1 class="hero-scene__title">{{ SITE_HOME_CONFIG.heroTitle }}</h1>
          <p class="hero-scene__summary">{{ SITE_HOME_CONFIG.heroSummary }}</p>

          <div class="hero-scene__actions">
            <RouterLink class="story-button story-button--primary" :to="SITE_HOME_CONFIG.primaryCta.to">
              {{ SITE_HOME_CONFIG.primaryCta.label }}
            </RouterLink>
            <RouterLink class="story-button story-button--ghost" :to="SITE_HOME_CONFIG.secondaryCta.to">
              {{ SITE_HOME_CONFIG.secondaryCta.label }}
            </RouterLink>
          </div>
        </div>

        <div class="hero-scene__art">
          <div class="hero-ribbon">
            <img
              v-for="asset in SITE_HERO_ASSETS"
              :key="asset.slot"
              class="hero-ribbon__item"
              :class="`hero-ribbon__item--${asset.slot}`"
              :src="asset.src"
              :alt="asset.alt"
            />
          </div>

          <div class="hero-note hero-note--top">{{ SITE_HOME_CONFIG.visualTags[0] }}</div>
          <div class="hero-note hero-note--bottom">{{ SITE_HOME_CONFIG.visualTags[1] }}</div>
        </div>
      </div>
    </section>

    <section class="story-section story-section--friction js-story-section">
      <div ref="frictionShellRef" class="story-shell story-shell--friction" :style="{ '--story-steps': frictionStepCount }">
        <div class="story-pin">
          <div class="story-panel story-panel--friction is-friction-0">
            <div class="story-panel__ornaments story-panel__ornaments--friction" aria-hidden="true">
              <svg class="sequence-line-svg is-first" viewBox="0 0 420 760">
                <path d="M334 22C356 78 354 132 324 188C284 262 242 280 212 338C184 390 190 450 234 498C274 542 332 566 334 644C336 688 316 724 290 746" />
                <circle cx="334" cy="22" r="8" />
                <circle cx="290" cy="746" r="8" />
              </svg>
              <svg class="sequence-line-svg is-second" viewBox="0 0 360 760">
                <path d="M22 148C94 134 156 168 188 214C224 266 224 320 198 374C170 430 118 458 104 514C88 576 118 634 194 690" />
                <circle cx="22" cy="148" r="7" />
                <circle cx="194" cy="690" r="7" />
              </svg>
            </div>

            <div class="section-copy story-copy-block">
              <h2>{{ SITE_HOME_CONFIG.frictionTitle }}</h2>
              <p>{{ SITE_HOME_CONFIG.frictionSummary }}</p>
            </div>

            <div class="story-stage-shell story-stage-shell--friction">
              <div ref="frictionVisualRef" class="story-visual friction-visual" data-friction-visual>
                <div class="friction-visual__halo" aria-hidden="true" />
                <div class="friction-visual__core">
                  <img :src="frictionLead.art" :alt="frictionLead.artAlt" />
                </div>
                <div class="friction-visual__tag friction-visual__tag--top">{{ SITE_FRICTION_LINES[0]?.title }}</div>
                <div class="friction-visual__tag friction-visual__tag--bottom">{{ SITE_FRICTION_LINES[2]?.title }}</div>
              </div>

              <div class="story-notes story-notes--friction">
                <article
                  v-for="(line, index) in SITE_FRICTION_LINES"
                  :key="line.title"
                  class="story-note-card friction-note-card"
                  :data-side="index % 2 === 0 ? 'right' : 'left'"
                  data-friction-note
                >
                  <div class="story-note-card__head">
                    <span class="story-note-card__index">{{ line.label }}</span>
                    <img class="story-note-card__stamp" :src="line.art" :alt="line.artAlt" />
                  </div>
                  <strong>{{ line.title }}</strong>
                  <p>{{ line.summary }}</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="story-section story-section--flow js-story-section">
      <div ref="flowShellRef" class="story-shell story-shell--flow" :style="{ '--story-steps': flowStepCount }">
        <div class="story-pin">
          <div class="story-panel story-panel--flow is-flow-0">
            <div class="story-panel__ornaments story-panel__ornaments--flow" aria-hidden="true">
              <svg class="sequence-line-svg is-first" viewBox="0 0 420 760">
                <path d="M54 734C68 652 126 614 184 586C248 554 314 510 336 438C352 384 340 320 298 284C256 246 196 240 150 206C102 170 76 112 96 22" />
                <circle cx="54" cy="734" r="8" />
                <circle cx="96" cy="22" r="8" />
              </svg>
              <svg class="sequence-line-svg is-second" viewBox="0 0 320 760">
                <path d="M286 108C242 132 224 174 214 218C204 268 200 318 164 362C124 412 60 432 36 500C18 550 32 616 88 678" />
                <circle cx="286" cy="108" r="7" />
                <circle cx="88" cy="678" r="7" />
              </svg>
            </div>

            <div class="section-copy story-copy-block">
              <h2>{{ SITE_HOME_CONFIG.flowTitle }}</h2>
              <p>{{ SITE_HOME_CONFIG.flowSummary }}</p>
            </div>

            <div class="story-stage-shell story-stage-shell--flow">
              <div ref="flowVisualRef" class="story-visual flow-visual" data-flow-visual>
                <div class="flow-visual__halo" aria-hidden="true" />
                <div class="flow-visual__stage">
                  <article
                    v-for="(step, index) in SITE_FLOW_STEPS"
                    :key="step.index"
                    class="flow-visual__layer"
                    :class="[`flow-visual__layer--${step.tone}`]"
                    data-flow-layer
                  >
                    <div class="flow-visual__stack">
                      <img :src="step.art" :alt="step.artAlt" />
                      <img
                        v-if="step.artSecondary"
                        class="flow-visual__secondary"
                        :src="step.artSecondary"
                        :alt="step.artSecondaryAlt ?? step.artAlt"
                      />
                    </div>
                    <div class="flow-visual__label">{{ step.title }}</div>
                  </article>
                </div>
              </div>

              <div class="story-notes story-notes--flow">
                <article
                  v-for="(step, index) in SITE_FLOW_STEPS"
                  :key="step.index"
                  class="story-note-card flow-note-card"
                  :class="[`flow-note-card--${step.tone}`]"
                  :data-side="index % 2 === 0 ? 'left' : 'right'"
                  data-flow-note
                >
                  <span class="story-note-card__index">{{ step.index }}</span>
                  <strong>{{ step.title }}</strong>
                  <p class="story-note-card__summary">{{ step.summary }}</p>
                  <p>{{ step.detail }}</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="story-section story-section--rhythm js-story-section">
      <div class="story-stage rhythm-scene">
        <div class="section-copy">
          <h2>{{ SITE_HOME_CONFIG.rhythmTitle }}</h2>
          <p>{{ SITE_HOME_CONFIG.rhythmSummary }}</p>
        </div>

        <div class="rhythm-shell">
          <div class="rhythm-ornaments" aria-hidden="true">
            <svg class="sequence-line-svg is-first" viewBox="0 0 1200 420">
              <path d="M42 304C126 318 198 280 264 224C332 166 402 126 492 128C572 130 630 176 696 224C772 280 858 318 958 296C1030 280 1090 236 1158 154" />
              <circle cx="42" cy="304" r="8" />
              <circle cx="1158" cy="154" r="8" />
            </svg>
            <svg class="sequence-line-svg is-second" viewBox="0 0 1200 420">
              <path d="M110 58C186 104 224 164 294 204C362 244 444 254 532 220C618 186 684 118 764 100C856 80 944 116 1046 220" />
              <circle cx="110" cy="58" r="7" />
              <circle cx="1046" cy="220" r="7" />
            </svg>
          </div>

          <div class="rhythm-stage">
            <article
              v-for="(step, index) in SITE_RHYTHM_STEPS"
              :key="step.index"
              class="rhythm-story"
              :class="[`rhythm-story--${step.tone}`, { 'rhythm-story--featured': index === SITE_RHYTHM_STEPS.length - 1 }]"
              :style="{ '--story-order': index }"
            >
              <div class="rhythm-story__copy">
                <span>{{ step.index }}</span>
                <strong>{{ step.title }}</strong>
                <p class="rhythm-story__summary">{{ step.summary }}</p>
                <p>{{ step.detail }}</p>
              </div>

              <div class="rhythm-story__visual">
                <div class="rhythm-story__visual-stack">
                  <img :src="step.art" :alt="step.artAlt" />
                  <img
                    v-if="step.artSecondary"
                    class="rhythm-story__visual-secondary"
                    :src="step.artSecondary"
                    :alt="step.artSecondaryAlt ?? step.artAlt"
                  />
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="story-section story-section--close js-story-section">
      <div class="story-stage close-scene">
        <div class="section-copy close-scene__copy">
          <h2>{{ SITE_HOME_CONFIG.closeTitle }}</h2>
          <p>{{ SITE_HOME_CONFIG.closeSummary }}</p>

          <RouterLink class="story-button story-button--primary" :to="SITE_HOME_CONFIG.primaryCta.to">
            {{ SITE_HOME_CONFIG.primaryCta.label }}
          </RouterLink>
        </div>

        <div class="close-scene__links">
          <RouterLink
            v-for="doc in featuredDocs"
            :key="doc.slug"
            class="close-link"
            :to="doc.path"
          >
            <span>{{ doc.label }}</span>
            <strong>{{ doc.title }}</strong>
            <p>{{ doc.summary }}</p>
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_FLOW_STEPS, SITE_FRICTION_LINES, SITE_HERO_ASSETS, SITE_HOME_CONFIG, SITE_RHYTHM_STEPS } from "@/config/app";
import { docsBySlug } from "@/content/docs";

gsap.registerPlugin(ScrollTrigger);

const pageRef = ref<HTMLElement | null>(null);
const frictionShellRef = ref<HTMLElement | null>(null);
const frictionVisualRef = ref<HTMLElement | null>(null);
const flowShellRef = ref<HTMLElement | null>(null);
const flowVisualRef = ref<HTMLElement | null>(null);
const featuredDocs = computed(() =>
  [...SITE_HOME_CONFIG.featuredDocSlugs]
    .map((slug) => docsBySlug.get(slug))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
);
const frictionLead = SITE_FRICTION_LINES[0];
const frictionStepCount = SITE_FRICTION_LINES.length;
const flowStepCount = SITE_FLOW_STEPS.length;

let sectionObserver: IntersectionObserver | null = null;
let context: gsap.Context | null = null;
let media: gsap.MatchMedia | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function syncPanelStepClass(panel: HTMLElement | null, prefix: "friction" | "flow", activeIndex: number) {
  if (!panel) {
    return;
  }

  panel.classList.forEach((className) => {
    if (className.startsWith(`is-${prefix}-`)) {
      panel.classList.remove(className);
    }
  });
  panel.classList.add(`is-${prefix}-${activeIndex}`);
}

function toggleSectionStates() {
  const root = pageRef.value;
  if (!root) {
    return;
  }

  const sections = [...root.querySelectorAll<HTMLElement>(".js-story-section")];
  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-active", entry.isIntersecting && entry.intersectionRatio > 0.24);
      });
    },
    {
      threshold: [0.24, 0.45, 0.7],
      rootMargin: "-10% 0px -10% 0px"
    }
  );

  sections.forEach((section, index) => {
    if (index === 0) {
      section.classList.add("is-active");
    }
    sectionObserver?.observe(section);
  });
}

function setNoteDeck(notes: HTMLElement[], scaled: number, activeIndex: number) {
  notes.forEach((note, index) => {
    const side = note.dataset.side === "left" ? -1 : 1;
    const delta = scaled - index;
    let autoAlpha = 0;
    let yPercent = 24;
    let xPercent = side * 8;
    let scale = 0.98;
    let rotate = side * 6;

    if (delta <= -1) {
      autoAlpha = 0;
      yPercent = 24;
      xPercent = side * 10;
      scale = 0.98;
      rotate = side * 6;
    } else if (delta < 0) {
      const t = delta + 1;
      autoAlpha = t;
      yPercent = lerp(24, 0, t);
      xPercent = lerp(side * 10, 0, t);
      scale = lerp(0.98, 1, t);
      rotate = lerp(side * 6, side * 1.2, t);
    } else if (delta < 1) {
      autoAlpha = lerp(1, 0.42, delta);
      yPercent = lerp(0, -12, delta);
      xPercent = lerp(0, side * 4, delta);
      scale = lerp(1, 0.94, delta);
      rotate = lerp(side * 1.2, side * 2.8, delta);
    } else {
      const t = clamp(delta - 1, 0, 1);
      autoAlpha = lerp(0.42, 0.2, t);
      yPercent = lerp(-12, -20, t);
      xPercent = lerp(side * 4, side * 6, t);
      scale = lerp(0.94, 0.9, t);
      rotate = lerp(side * 2.8, side * 4.4, t);
    }

    gsap.set(note, {
      autoAlpha,
      yPercent,
      xPercent,
      scale,
      rotate,
      zIndex: index === activeIndex ? notes.length + 2 : notes.length - Math.abs(activeIndex - index),
      force3D: true
    });

    note.classList.toggle("is-current", index === activeIndex);
  });
}

function setVisualDeck(layers: HTMLElement[], scaled: number, activeIndex: number) {
  layers.forEach((layer, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const delta = scaled - index;
    let autoAlpha = 0;
    let yPercent = 18;
    let scale = 0.94;
    let rotate = direction * 8;

    if (delta <= -1) {
      autoAlpha = 0;
      yPercent = 18;
      scale = 0.94;
      rotate = direction * 8;
    } else if (delta < 0) {
      const t = delta + 1;
      autoAlpha = t;
      yPercent = lerp(18, 0, t);
      scale = lerp(0.94, 1, t);
      rotate = lerp(direction * 8, 0, t);
    } else if (delta < 1) {
      autoAlpha = lerp(1, 0.22, delta);
      yPercent = lerp(0, -12, delta);
      scale = lerp(1, 0.92, delta);
      rotate = lerp(0, direction * 6, delta);
    } else {
      autoAlpha = 0;
      yPercent = -14;
      scale = 0.9;
      rotate = direction * 7;
    }

    gsap.set(layer, {
      autoAlpha,
      yPercent,
      scale,
      rotate,
      zIndex: index === activeIndex ? layers.length + 2 : layers.length - Math.abs(activeIndex - index),
      force3D: true
    });

    layer.classList.toggle("is-current", index === activeIndex);
  });
}

function buildHeroMotion(root: HTMLElement) {
  const heroItems = gsap.utils.toArray<HTMLElement>(".hero-ribbon__item", root);
  const heroNotes = gsap.utils.toArray<HTMLElement>(".hero-note", root);

  heroItems.forEach((item: HTMLElement, index: number) => {
    gsap.to(item, {
      yPercent: index % 2 === 0 ? -4 : 6,
      xPercent: index % 2 === 0 ? 2 : -3,
      rotate: index % 2 === 0 ? -3 : 3,
      duration: 4.6 + index * 0.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
  });

  heroNotes.forEach((note: HTMLElement, index: number) => {
    gsap.to(note, {
      yPercent: index === 0 ? -6 : 5,
      xPercent: index === 0 ? 3 : -2,
      duration: 3.8 + index * 0.4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
  });
}

function buildFrictionScene() {
  const shell = frictionShellRef.value;
  const visual = frictionVisualRef.value;
  if (!shell || !visual) {
    return;
  }

  const pin = shell.querySelector<HTMLElement>(".story-pin");
  const panel = shell.querySelector<HTMLElement>(".story-panel--friction");
  const notes = gsap.utils.toArray<HTMLElement>("[data-friction-note]", shell);
  const tags = gsap.utils.toArray<HTMLElement>(".friction-visual__tag", shell);
  const segments = Math.max(notes.length - 1, 1);
  if (!pin || !panel) {
    return;
  }

  setNoteDeck(notes, 0, 0);
  syncPanelStepClass(panel, "friction", 0);
  gsap.set(visual, { yPercent: 12, scale: 0.96, rotate: -4, force3D: true });

  ScrollTrigger.create({
    trigger: shell,
    start: "top top",
    end: "bottom bottom",
    pin,
    pinSpacing: false,
    anticipatePin: 1,
    scrub: 0.75,
    invalidateOnRefresh: true,
    onUpdate: (self: ScrollTrigger) => {
      const scaled = self.progress * segments;
      const activeIndex = clamp(Math.round(scaled), 0, notes.length - 1);
      const progress = scaled / segments;

      syncPanelStepClass(panel, "friction", activeIndex);
      setNoteDeck(notes, scaled, activeIndex);
      gsap.set(visual, {
        yPercent: lerp(12, -10, progress),
        scale: 0.96 + Math.sin(progress * Math.PI) * 0.08,
        rotate: lerp(-4, 3, progress),
        force3D: true
      });

      tags.forEach((tag: HTMLElement, index: number) => {
        const direction = index === 0 ? -1 : 1;
        gsap.set(tag, {
          yPercent: lerp(direction * 8, direction * -4, progress),
          xPercent: lerp(direction * -4, direction * 4, progress),
          force3D: true
        });
      });
    }
  });
}

function buildFlowScene() {
  const shell = flowShellRef.value;
  const visual = flowVisualRef.value;
  if (!shell || !visual) {
    return;
  }

  const pin = shell.querySelector<HTMLElement>(".story-pin");
  const panel = shell.querySelector<HTMLElement>(".story-panel--flow");
  const notes = gsap.utils.toArray<HTMLElement>("[data-flow-note]", shell);
  const layers = gsap.utils.toArray<HTMLElement>("[data-flow-layer]", shell);
  const segments = Math.max(layers.length - 1, 1);
  if (!pin || !panel) {
    return;
  }

  setNoteDeck(notes, 0, 0);
  setVisualDeck(layers, 0, 0);
  syncPanelStepClass(panel, "flow", 0);
  gsap.set(visual, { yPercent: 10, scale: 0.98, rotate: -2, force3D: true });

  ScrollTrigger.create({
    trigger: shell,
    start: "top top",
    end: "bottom bottom",
    pin,
    pinSpacing: false,
    anticipatePin: 1,
    scrub: 0.85,
    invalidateOnRefresh: true,
    onUpdate: (self: ScrollTrigger) => {
      const scaled = self.progress * segments;
      const activeIndex = clamp(Math.round(scaled), 0, layers.length - 1);
      const progress = scaled / segments;

      syncPanelStepClass(panel, "flow", activeIndex);
      setNoteDeck(notes, scaled, activeIndex);
      setVisualDeck(layers, scaled, activeIndex);
      gsap.set(visual, {
        yPercent: lerp(10, -8, progress),
        scale: 0.98 + Math.sin(progress * Math.PI) * 0.05,
        rotate: lerp(-2, 2, progress),
        force3D: true
      });
    }
  });
}

function buildMobileReveal(root: HTMLElement) {
  gsap.utils.toArray<HTMLElement>(".story-note-card, .rhythm-story, .close-link", root).forEach((item: HTMLElement) => {
    gsap.fromTo(
      item,
      { autoAlpha: 0, y: 40 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: item,
          start: "top 85%",
          once: true
        }
      }
    );
  });
}

function refreshStory() {
  ScrollTrigger.refresh();
}

onMounted(() => {
  const root = pageRef.value;
  if (!root) {
    return;
  }

  toggleSectionStates();

  context = gsap.context(() => {
    media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      buildHeroMotion(root);
    });

    media.add("(min-width: 961px) and (prefers-reduced-motion: no-preference)", () => {
      buildFrictionScene();
      buildFlowScene();
    });

    media.add("(max-width: 960px) and (prefers-reduced-motion: no-preference)", () => {
      buildMobileReveal(root);
    });
  }, root);

  window.addEventListener("load", refreshStory);
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
});

onBeforeUnmount(() => {
  sectionObserver?.disconnect();
  media?.revert();
  context?.revert();
  window.removeEventListener("load", refreshStory);
});
</script>

<style scoped lang="scss">
.narrative-home {
  --story-width: min(1220px, calc(100% - 72px));
  display: grid;
  gap: 0;
  width: 100%;
}

.story-section {
  position: relative;
  padding: 0;
}

.story-stage,
.story-pin {
  width: var(--story-width);
  margin: 0 auto;
  min-height: 100dvh;
  padding: calc(var(--site-header-height, 0px) + 18px) 0 24px;
}

.story-stage,
.story-pin {
  display: grid;
  align-items: center;
}

.story-section::before {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 100vw;
  transform: translateX(-50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 520ms ease;
}

.story-section.is-active::before {
  opacity: 1;
}

.story-eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.section-copy,
.hero-scene__copy,
.close-scene__copy {
  display: grid;
  gap: 14px;
}

.section-copy h2,
.hero-scene__title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.07em;
  line-height: 0.94;
}

.section-copy h2 {
  font-size: clamp(2.8rem, 4vw, 4.8rem);
}

.section-copy p,
.hero-scene__summary,
.story-note-card p,
.rhythm-story__copy p,
.close-link p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.76;
}

.story-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 20px;
  border-radius: 999px;
  transition: transform 180ms ease, background-color 180ms ease, border-color 180ms ease;
}

.story-button:hover {
  transform: translateY(-2px);
}

.story-button--primary {
  background: var(--surface-dark);
  color: var(--page-bg);
}

.story-button--ghost {
  border: 1px solid var(--border-strong);
  background: rgba(255, 250, 244, 0.42);
  color: var(--text);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
}

.hero-scene {
  grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
  gap: 42px;
}

.hero-scene__copy {
  max-width: 540px;
  transform: translateY(56px);
  opacity: 0;
  transition: transform 620ms ease, opacity 620ms ease;
}

.story-section.is-active .hero-scene__copy,
.story-section.is-active .section-copy,
.story-section.is-active .close-scene__links {
  transform: translateY(0);
  opacity: 1;
}

.hero-scene__title {
  font-size: clamp(4.6rem, 7vw, 7.6rem);
}

.hero-scene__summary {
  max-width: 28ch;
  font-size: 1.08rem;
}

.hero-scene__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.hero-scene__art {
  position: relative;
  min-height: 560px;
  transform: translateY(64px) scale(0.96);
  opacity: 0;
  transition: transform 720ms ease, opacity 720ms ease;
}

.story-section.is-active .hero-scene__art {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.hero-scene__art::before {
  content: "";
  position: absolute;
  inset: 18% 6% 22%;
  border-radius: 44px;
  background:
    radial-gradient(circle at 14% 44%, rgba(235, 188, 128, 0.26), transparent 26%),
    radial-gradient(circle at 52% 18%, rgba(166, 205, 139, 0.3), transparent 28%),
    radial-gradient(circle at 88% 46%, rgba(244, 215, 144, 0.24), transparent 28%),
    linear-gradient(160deg, rgba(255, 252, 246, 0.36), rgba(255, 251, 241, 0.18));
  border: 1px solid rgba(255, 255, 255, 0.34);
  box-shadow: 0 34px 90px rgba(74, 81, 58, 0.12);
  backdrop-filter: blur(26px) saturate(126%);
  -webkit-backdrop-filter: blur(26px) saturate(126%);
}

.hero-ribbon {
  position: absolute;
  inset: 10% 0 16%;
}

.hero-ribbon__item {
  position: absolute;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 22px 32px rgba(92, 93, 70, 0.14));
}

.hero-ribbon__item--citrus {
  left: 0;
  bottom: 12%;
  width: min(46%, 340px);
}

.hero-ribbon__item--basil {
  left: 30%;
  top: 4%;
  width: min(32%, 236px);
}

.hero-ribbon__item--papaya {
  right: 14%;
  top: 10%;
  width: min(34%, 248px);
}

.hero-ribbon__item--tomatoes {
  right: 2%;
  bottom: 10%;
  width: min(24%, 176px);
}

.hero-note {
  position: absolute;
  display: inline-flex;
  align-items: center;
  padding: 11px 16px;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.3);
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 600;
  backdrop-filter: blur(18px) saturate(126%);
  -webkit-backdrop-filter: blur(18px) saturate(126%);
}

.hero-note--top {
  top: 14%;
  left: 0;
}

.hero-note--bottom {
  right: 8%;
  bottom: 9%;
}

.story-shell {
  --story-steps: 3;
  min-height: calc((var(--story-steps) + 0.9) * 72dvh);
}

.story-panel {
  position: relative;
  display: grid;
  gap: 28px;
  isolation: isolate;
  overflow: hidden;
}

.story-panel > *,
.rhythm-shell > * {
  position: relative;
  z-index: 1;
}

.story-panel__ornaments,
.rhythm-ornaments {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.sequence-line-svg {
  position: absolute;
  overflow: visible;
  opacity: 0.34;
  transition: transform 760ms ease, opacity 420ms ease;
}

.sequence-line-svg path {
  fill: none;
  stroke: rgba(90, 134, 101, 0.42);
  stroke-width: 3.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1600;
  stroke-dashoffset: 1600;
  transition: stroke-dashoffset 900ms cubic-bezier(0.2, 0.82, 0.24, 1);
}

.sequence-line-svg circle {
  fill: rgba(215, 138, 59, 0.26);
  stroke: rgba(90, 134, 101, 0.4);
  stroke-width: 1.4;
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  transition: opacity 320ms ease 180ms, transform 620ms ease;
  transform: scale(0.8);
}

.story-section.is-active .sequence-line-svg path {
  stroke-dashoffset: 0;
}

.story-section.is-active .sequence-line-svg circle {
  opacity: 1;
  transform: scale(1);
}

.story-panel--friction,
.story-panel--flow {
  align-content: start;
}

.story-copy-block {
  max-width: 720px;
}

.story-stage-shell {
  position: relative;
  min-height: clamp(480px, 72dvh, 640px);
  display: grid;
  align-items: center;
}

.story-visual {
  position: relative;
  display: grid;
  place-items: center;
  width: min(100%, 520px);
  margin: 0 auto;
}

.friction-visual,
.flow-visual {
  min-height: clamp(320px, 54dvh, 500px);
}

.friction-visual__halo,
.flow-visual__halo {
  position: absolute;
  inset: 12% 14%;
  border-radius: 999px;
  filter: blur(18px);
  background:
    radial-gradient(circle at 30% 30%, rgba(164, 206, 138, 0.34), transparent 42%),
    radial-gradient(circle at 70% 68%, rgba(238, 193, 129, 0.28), transparent 38%);
}

.friction-visual__core {
  position: relative;
  display: grid;
  place-items: center;
  width: min(100%, 390px);
  aspect-ratio: 1 / 1;
  padding: 42px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 38px;
  background:
    radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.82), transparent 34%),
    linear-gradient(180deg, rgba(255, 252, 246, 0.62), rgba(255, 249, 240, 0.18));
  box-shadow: 0 10px 24px rgba(84, 88, 62, 0.05);
}

.friction-visual__core img {
  width: min(100%, 270px);
  max-height: 270px;
  object-fit: contain;
  filter: drop-shadow(0 24px 34px rgba(95, 93, 68, 0.14));
}

.friction-visual__tag {
  position: absolute;
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.34);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
}

.friction-visual__tag--top {
  top: 8%;
  left: 4%;
}

.friction-visual__tag--bottom {
  right: 4%;
  bottom: 10%;
}

.flow-visual__stage {
  position: relative;
  width: min(100%, 430px);
  aspect-ratio: 1 / 0.94;
}

.flow-visual__layer {
  position: absolute;
  inset: 0;
  display: grid;
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 34px;
  background:
    linear-gradient(180deg, rgba(255, 252, 246, 0.42), rgba(255, 251, 241, 0.14)),
    rgba(255, 250, 244, 0.14);
  box-shadow: 0 10px 26px rgba(74, 81, 58, 0.05);
}

.flow-visual__layer--forest {
  background:
    radial-gradient(circle at 82% 18%, rgba(172, 206, 142, 0.22), transparent 26%),
    rgba(247, 251, 243, 0.18);
}

.flow-visual__layer--mist {
  background:
    radial-gradient(circle at 80% 18%, rgba(209, 225, 204, 0.22), transparent 28%),
    rgba(248, 251, 247, 0.16);
}

.flow-visual__layer--amber {
  background:
    radial-gradient(circle at 78% 18%, rgba(234, 188, 127, 0.22), transparent 28%),
    rgba(251, 247, 241, 0.16);
}

.flow-visual__stack {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.flow-visual__stack img:first-child {
  width: min(100%, 250px);
  max-height: 250px;
  object-fit: contain;
  filter: drop-shadow(0 22px 32px rgba(95, 93, 68, 0.12));
}

.flow-visual__secondary {
  position: absolute;
  right: 4%;
  bottom: 4%;
  width: min(38%, 116px);
  max-height: 116px;
}

.flow-visual__label {
  position: absolute;
  left: 18px;
  bottom: 18px;
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.34);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
}

.story-notes {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.story-note-card {
  position: absolute;
  display: grid;
  gap: 10px;
  width: min(32vw, 320px);
  padding: 22px 22px 18px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 252, 246, 0.58), rgba(255, 250, 242, 0.24)),
    rgba(255, 252, 246, 0.18);
  box-shadow: 0 10px 24px rgba(83, 78, 58, 0.05);
  transform-origin: center;
}

.story-visual,
.friction-visual__core,
.friction-visual__tag,
.flow-visual__layer,
.flow-visual__label,
.story-note-card {
  will-change: transform, opacity;
  transform: translateZ(0);
  backface-visibility: hidden;
  contain: layout paint;
}

.story-note-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.story-note-card__index {
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.story-note-card strong,
.rhythm-story__copy strong,
.close-link strong {
  margin: 0;
  font-family: var(--font-display);
  color: var(--text);
}

.story-note-card strong {
  font-size: clamp(2rem, 3vw, 3rem);
  line-height: 0.98;
  letter-spacing: -0.06em;
}

.story-note-card__summary {
  color: var(--text) !important;
}

.story-note-card__stamp {
  width: 58px;
  height: 58px;
  object-fit: contain;
  filter: drop-shadow(0 12px 18px rgba(95, 93, 68, 0.12));
}

.story-notes--friction .story-note-card:nth-child(1) {
  top: 4%;
  right: 2%;
}

.story-notes--friction .story-note-card:nth-child(2) {
  top: 36%;
  left: 0;
}

.story-notes--friction .story-note-card:nth-child(3) {
  right: 8%;
  bottom: 6%;
}

.story-notes--flow .story-note-card:nth-child(1) {
  top: 6%;
  left: 0;
}

.story-notes--flow .story-note-card:nth-child(2) {
  top: 34%;
  right: 2%;
}

.story-notes--flow .story-note-card:nth-child(3) {
  bottom: 2%;
  left: 8%;
}

.flow-note-card--forest {
  background:
    radial-gradient(circle at 84% 12%, rgba(172, 206, 142, 0.24), transparent 28%),
    rgba(247, 251, 243, 0.22);
}

.flow-note-card--mist {
  background:
    radial-gradient(circle at 84% 12%, rgba(209, 225, 204, 0.24), transparent 28%),
    rgba(248, 251, 247, 0.22);
}

.flow-note-card--amber {
  background:
    radial-gradient(circle at 84% 12%, rgba(234, 188, 127, 0.24), transparent 28%),
    rgba(251, 247, 241, 0.22);
}

.story-panel__ornaments--friction .sequence-line-svg.is-first {
  top: -7%;
  right: 10%;
  width: min(34vw, 360px);
}

.story-panel__ornaments--friction .sequence-line-svg.is-second {
  left: -2%;
  bottom: 2%;
  width: min(30vw, 290px);
}

.is-friction-0 .story-panel__ornaments--friction .sequence-line-svg.is-first {
  transform: translate3d(8px, -26px, 0) rotate(3deg);
  opacity: 0.42;
}

.is-friction-1 .story-panel__ornaments--friction .sequence-line-svg.is-first {
  transform: translate3d(-28px, 28px, 0) rotate(8deg);
  opacity: 0.6;
}

.is-friction-2 .story-panel__ornaments--friction .sequence-line-svg.is-first {
  transform: translate3d(-42px, 64px, 0) rotate(13deg);
  opacity: 0.48;
}

.is-friction-0 .story-panel__ornaments--friction .sequence-line-svg.is-second {
  transform: translate3d(-34px, 26px, 0) rotate(-9deg);
}

.is-friction-1 .story-panel__ornaments--friction .sequence-line-svg.is-second {
  transform: translate3d(16px, -8px, 0) rotate(1deg);
  opacity: 0.5;
}

.is-friction-2 .story-panel__ornaments--friction .sequence-line-svg.is-second {
  transform: translate3d(38px, -34px, 0) rotate(7deg);
  opacity: 0.6;
}

.story-panel__ornaments--flow .sequence-line-svg.is-first {
  left: -1%;
  top: 6%;
  width: min(34vw, 348px);
}

.story-panel__ornaments--flow .sequence-line-svg.is-second {
  right: 4%;
  bottom: 0;
  width: min(28vw, 260px);
}

.is-flow-0 .story-panel__ornaments--flow .sequence-line-svg.is-first {
  transform: translate3d(-28px, 26px, 0) rotate(-8deg);
  opacity: 0.48;
}

.is-flow-1 .story-panel__ornaments--flow .sequence-line-svg.is-first {
  transform: translate3d(12px, -10px, 0) rotate(-1deg);
  opacity: 0.64;
}

.is-flow-2 .story-panel__ornaments--flow .sequence-line-svg.is-first {
  transform: translate3d(34px, -34px, 0) rotate(4deg);
  opacity: 0.46;
}

.is-flow-0 .story-panel__ornaments--flow .sequence-line-svg.is-second {
  transform: translate3d(32px, -18px, 0) rotate(5deg);
}

.is-flow-1 .story-panel__ornaments--flow .sequence-line-svg.is-second {
  transform: translate3d(-12px, 18px, 0) rotate(-6deg);
  opacity: 0.56;
}

.is-flow-2 .story-panel__ornaments--flow .sequence-line-svg.is-second {
  transform: translate3d(-38px, 28px, 0) rotate(-11deg);
  opacity: 0.44;
}

.section-copy,
.close-scene__links {
  transform: translateY(52px);
  opacity: 0;
  transition: transform 560ms ease, opacity 560ms ease;
}

.rhythm-scene,
.close-scene {
  gap: 32px;
}

.rhythm-shell {
  position: relative;
  isolation: isolate;
}

.rhythm-shell > * {
  position: relative;
}

.rhythm-stage {
  display: grid;
  grid-template-columns: minmax(0, 0.96fr) minmax(0, 1.04fr);
  gap: 18px;
  z-index: 2;
}

.rhythm-ornaments .sequence-line-svg.is-first {
  top: 6%;
  left: 4%;
  width: 92%;
  transform: translate3d(0, 28px, 0) rotate(-1.5deg);
}

.rhythm-ornaments .sequence-line-svg.is-second {
  top: 0;
  left: 10%;
  width: 78%;
  transform: translate3d(0, -16px, 0) rotate(2.5deg);
  opacity: 0.3;
}

.story-section.is-active .rhythm-ornaments .sequence-line-svg.is-first {
  transform: translate3d(0, -12px, 0) rotate(-4deg);
  opacity: 0.5;
}

.story-section.is-active .rhythm-ornaments .sequence-line-svg.is-second {
  transform: translate3d(0, 16px, 0) rotate(5deg);
  opacity: 0.42;
}

.rhythm-story {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 220px);
  align-items: center;
  min-height: 260px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 252, 246, 0.34), rgba(255, 251, 241, 0.14)),
    rgba(255, 250, 244, 0.12);
  box-shadow: 0 22px 54px rgba(74, 81, 58, 0.08);
  backdrop-filter: blur(18px) saturate(118%);
  -webkit-backdrop-filter: blur(18px) saturate(118%);
  transform: translateY(56px);
  opacity: 0;
  transition: transform 520ms ease, opacity 520ms ease;
  transition-delay: calc(var(--story-order, 0) * 70ms);
}

.rhythm-story:nth-child(1) {
  z-index: 3;
}

.rhythm-story:nth-child(2) {
  z-index: 1;
}

.story-section.is-active .rhythm-story {
  transform: translateY(0);
  opacity: 1;
}

.rhythm-story--featured {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-content: space-between;
  min-height: 538px;
  padding: 28px;
  z-index: 4;
}

.rhythm-story__copy {
  display: grid;
  gap: 10px;
}

.rhythm-story__copy span {
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.rhythm-story__copy strong {
  font-size: clamp(1.8rem, 2.6vw, 2.5rem);
  line-height: 1.02;
  letter-spacing: -0.05em;
}

.rhythm-story__summary {
  color: var(--text) !important;
}

.rhythm-story__visual,
.rhythm-story__visual-stack {
  display: flex;
  align-items: center;
  justify-content: center;
}

.rhythm-story__visual-stack {
  position: relative;
  width: min(100%, 210px);
}

.rhythm-story__visual img {
  width: min(100%, 210px);
  max-height: 210px;
  object-fit: contain;
  filter: drop-shadow(0 18px 28px rgba(95, 93, 68, 0.12));
}

.rhythm-story__visual-secondary {
  position: absolute;
  right: -8%;
  bottom: -8%;
  width: min(52%, 114px);
  max-height: 114px;
}

.rhythm-story--forest {
  background:
    radial-gradient(circle at 82% 18%, rgba(172, 206, 142, 0.18), transparent 26%),
    rgba(247, 251, 243, 0.14);
}

.rhythm-story--mist {
  background:
    radial-gradient(circle at 80% 18%, rgba(209, 225, 204, 0.2), transparent 28%),
    rgba(248, 251, 247, 0.14);
}

.rhythm-story--amber {
  background:
    radial-gradient(circle at 78% 18%, rgba(234, 188, 127, 0.18), transparent 28%),
    rgba(251, 247, 241, 0.14);
}

.rhythm-story--featured .rhythm-story__copy strong {
  font-size: clamp(2.2rem, 3vw, 3rem);
}

.close-scene {
  grid-template-columns: minmax(0, 0.84fr) minmax(0, 1.16fr);
}

.close-scene__copy .story-button {
  margin-top: 10px;
}

.close-scene__links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.close-link {
  display: grid;
  gap: 10px;
  min-height: 176px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(255, 252, 246, 0.34), rgba(255, 251, 241, 0.14)),
    rgba(255, 250, 244, 0.12);
  box-shadow: 0 22px 54px rgba(74, 81, 58, 0.08);
  backdrop-filter: blur(16px) saturate(118%);
  -webkit-backdrop-filter: blur(16px) saturate(118%);
  transition: transform 180ms ease;
}

.close-link:hover {
  transform: translateY(-2px);
}

.close-link span {
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.story-section--hero::before {
  background:
    radial-gradient(circle at 14% 32%, rgba(168, 203, 136, 0.18), transparent 22%),
    radial-gradient(circle at 88% 28%, rgba(238, 193, 129, 0.18), transparent 20%);
}

.story-section--friction::before {
  background:
    radial-gradient(circle at 12% 44%, rgba(169, 203, 136, 0.16), transparent 24%),
    radial-gradient(circle at 82% 22%, rgba(241, 203, 152, 0.12), transparent 22%);
}

.story-section--flow::before {
  background:
    radial-gradient(circle at 82% 20%, rgba(173, 205, 143, 0.18), transparent 22%),
    radial-gradient(circle at 20% 80%, rgba(238, 193, 129, 0.12), transparent 24%);
}

.story-section--rhythm::before,
.story-section--close::before {
  background: radial-gradient(circle at 10% 20%, rgba(168, 203, 136, 0.14), transparent 22%);
}

@media (max-width: 1180px) {
  .hero-scene,
  .close-scene {
    grid-template-columns: 1fr;
  }

  .rhythm-stage {
    grid-template-columns: 1fr;
  }

  .rhythm-story,
  .rhythm-story--featured {
    grid-column: auto;
    grid-row: auto;
    min-height: 280px;
  }
}

@media (max-width: 960px) {
  .narrative-home {
    --story-width: min(100%, calc(100% - 44px));
  }

  .story-shell {
    min-height: auto;
  }

  .story-stage,
  .story-pin {
    min-height: auto;
  }

  .story-panel,
  .rhythm-story,
  .close-link {
    padding: 22px;
    border-radius: 24px;
  }

  .hero-scene__art {
    min-height: 420px;
  }

  .hero-ribbon__item--citrus {
    width: min(52%, 280px);
  }

  .hero-ribbon__item--basil {
    left: 26%;
    width: min(30%, 180px);
  }

  .hero-ribbon__item--papaya {
    right: 12%;
    width: min(30%, 200px);
  }

  .hero-ribbon__item--tomatoes {
    width: min(22%, 122px);
  }

  .story-stage-shell {
    min-height: auto;
    gap: 18px;
  }

  .story-notes {
    position: static;
    display: grid;
    gap: 14px;
    pointer-events: auto;
  }

  .story-note-card {
    position: relative;
    width: 100%;
    opacity: 1 !important;
    transform: none !important;
    inset: auto !important;
  }

  .friction-visual,
  .flow-visual {
    width: min(100%, 320px);
    min-height: 280px;
  }

  .friction-visual__core {
    width: min(100%, 280px);
    padding: 34px;
  }

  .friction-visual__core img {
    width: min(100%, 190px);
    max-height: 190px;
  }

  .flow-visual__stage {
    width: min(100%, 320px);
  }

  .flow-visual__layer {
    position: relative;
  }

  .flow-visual__layer:not(:first-child) {
    display: none;
  }

  .rhythm-stage,
  .close-scene__links {
    grid-template-columns: 1fr;
  }

  .story-panel__ornaments--friction .sequence-line-svg.is-first,
  .story-panel__ornaments--flow .sequence-line-svg.is-first {
    width: min(44vw, 320px);
  }

  .story-panel__ornaments--friction .sequence-line-svg.is-second,
  .story-panel__ornaments--flow .sequence-line-svg.is-second {
    width: min(34vw, 250px);
  }
}

@media (max-width: 720px) {
  .narrative-home {
    --story-width: min(100%, calc(100% - 28px));
  }

  .story-section {
    padding-bottom: 18px;
  }

  .story-stage,
  .story-pin {
    padding-top: calc(var(--site-header-height, 0px) + 14px);
  }

  .hero-scene__title {
    font-size: clamp(3.2rem, 14vw, 4.8rem);
  }

  .section-copy h2,
  .story-note-card strong {
    font-size: clamp(2.2rem, 10vw, 3.2rem);
  }

  .hero-scene__art {
    min-height: 340px;
  }

  .hero-scene__art::before {
    inset: 14% 0 16%;
    border-radius: 28px;
  }

  .hero-note {
    padding: 9px 13px;
    font-size: 0.78rem;
  }

  .hero-note--top {
    top: 4%;
  }

  .hero-note--bottom {
    right: 2%;
    bottom: 6%;
  }

  .story-panel {
    gap: 22px;
    padding: 18px;
  }

  .sequence-line-svg path {
    stroke-width: 2.6;
  }

  .story-note-card {
    padding: 18px;
  }

  .story-note-card__stamp {
    width: 48px;
    height: 48px;
  }

  .flow-visual__secondary,
  .rhythm-story__visual-secondary {
    right: -4%;
    bottom: -2%;
    width: min(42%, 88px);
    max-height: 88px;
  }

  .rhythm-stage {
    gap: 14px;
  }

  .rhythm-story {
    grid-template-columns: 1fr;
    padding: 22px;
  }

  .rhythm-story__visual {
    justify-content: flex-start;
  }

  .rhythm-story__visual img {
    width: min(54vw, 180px);
    max-height: 160px;
  }

  .rhythm-ornaments .sequence-line-svg.is-first {
    width: 138%;
    left: -20%;
    top: 18%;
    transform: translate3d(0, 26px, 0) rotate(-5deg);
  }

  .rhythm-ornaments .sequence-line-svg.is-second {
    width: 112%;
    left: -4%;
    top: 2%;
    transform: translate3d(0, -18px, 0) rotate(5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .story-section::before,
  .hero-scene__copy,
  .hero-scene__art,
  .section-copy,
  .close-scene__links,
  .rhythm-story,
  .close-link,
  .story-button {
    transition-duration: 0ms;
    transition-delay: 0ms;
  }

  .hero-scene__copy,
  .hero-scene__art,
  .section-copy,
  .close-scene__links,
  .rhythm-story {
    transform: none;
  }
}
</style>
