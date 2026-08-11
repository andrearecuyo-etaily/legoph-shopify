/**
 * Countdown for the Coming Soon page. The target is an ISO string from section
 * settings; it's parsed in the visitor's own timezone, and the timer stops (and
 * zeroes) once the date passes rather than counting negative.
 */
class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.target = new Date(this.dataset.launch).getTime();
    if (Number.isNaN(this.target)) return;

    this.fields = {
      days: this.querySelector('[data-countdown="days"]'),
      hours: this.querySelector('[data-countdown="hours"]'),
      minutes: this.querySelector('[data-countdown="minutes"]'),
      seconds: this.querySelector('[data-countdown="seconds"]'),
    };

    this.#tick();
    this.timer = setInterval(() => this.#tick(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
  }

  #tick() {
    const remaining = Math.max(0, this.target - Date.now());
    const total = Math.floor(remaining / 1000);

    this.#set('days', Math.floor(total / 86400));
    this.#set('hours', Math.floor((total % 86400) / 3600));
    this.#set('minutes', Math.floor((total % 3600) / 60));
    this.#set('seconds', total % 60);

    if (remaining === 0) clearInterval(this.timer);
  }

  #set(name, value) {
    const field = this.fields[name];
    if (field) field.textContent = String(value).padStart(2, '0');
  }
}

if (!customElements.get('countdown-timer')) {
  customElements.define('countdown-timer', CountdownTimer);
}
