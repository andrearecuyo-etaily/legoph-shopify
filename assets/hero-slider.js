const REDUCED_MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');

class HeroSlider extends HTMLElement {
  #timer = null;
  #index = 0;
  #slides = [];
  #dots = [];
  #suspended = false;

  connectedCallback() {
    this.#slides = Array.from(this.querySelectorAll('.hero-slider__slide'));
    this.#dots = Array.from(this.querySelectorAll('.hero-slider__dot'));

    if (this.#slides.length <= 1) return;

    this.querySelector('.hero-slider__arrow--prev')?.addEventListener('click', () => this.#go(this.#index - 1));
    this.querySelector('.hero-slider__arrow--next')?.addEventListener('click', () => this.#go(this.#index + 1));
    this.#dots.forEach((dot, i) => dot.addEventListener('click', () => this.#go(i)));

    this.addEventListener('pointerenter', this.#suspend);
    this.addEventListener('pointerleave', this.#resume);
    this.addEventListener('focusin', this.#suspend);
    this.addEventListener('focusout', this.#resume);
    this.addEventListener('touchstart', this.#suspend, { passive: true });
    this.addEventListener('touchend', this.#resume);

    this.#setupSwipe();
    this.#play();
  }

  disconnectedCallback() {
    this.#stop();
  }

  get #autoplayInterval() {
    const value = Number(this.dataset.autoplay);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  #play() {
    if (REDUCED_MOTION_QUERY.matches) return;
    const interval = this.#autoplayInterval;
    if (!interval || this.#suspended) return;
    this.#stop();
    this.#timer = window.setInterval(() => this.#go(this.#index + 1), interval);
  }

  #stop() {
    if (this.#timer) {
      window.clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #suspend = () => {
    this.#suspended = true;
    this.#stop();
  };

  #resume = () => {
    this.#suspended = false;
    this.#play();
  };

  #go(nextIndex) {
    const count = this.#slides.length;
    this.#index = (nextIndex + count) % count;

    this.#slides.forEach((slide, i) => {
      const isActive = i === this.#index;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');

      if (isActive) {
        const img = slide.querySelector('.hero-slider__image--lazy');
        if (img && !img.classList.contains('is-loaded')) {
          if (img.complete) {
            img.classList.add('is-loaded');
          } else {
            img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
          }
        }
      }
    });

    this.#dots.forEach((dot, i) => dot.classList.toggle('is-active', i === this.#index));
  }

  #setupSwipe() {
    const track = this.querySelector('.hero-slider__track');
    if (!track) return;

    let startX = 0;
    let tracking = false;

    track.addEventListener(
      'pointerdown',
      (event) => {
        startX = event.clientX;
        tracking = true;
      },
      { passive: true }
    );

    track.addEventListener(
      'pointerup',
      (event) => {
        if (!tracking) return;
        tracking = false;
        const delta = event.clientX - startX;
        if (Math.abs(delta) < 40) return;
        this.#go(delta < 0 ? this.#index + 1 : this.#index - 1);
      },
      { passive: true }
    );

    track.addEventListener(
      'pointercancel',
      () => {
        tracking = false;
      },
      { passive: true }
    );
  }
}

if (!customElements.get('hero-slider-component')) {
  customElements.define('hero-slider-component', HeroSlider);
}
