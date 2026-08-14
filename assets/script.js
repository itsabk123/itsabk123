// RealtyCompass — vanilla JS, no build step. Client-side validation only;
// every rule here is re-checked server-side before anything is stored.
(function () {
  'use strict';

  function showError(field, message) {
    clearError(field);
    var el = document.createElement('p');
    el.className = 'rc-field-error';
    el.setAttribute('data-rc-generated-error', 'true');
    el.textContent = message;
    field.insertAdjacentElement('afterend', el);
  }

  function clearError(field) {
    var next = field.nextElementSibling;
    if (next && next.hasAttribute('data-rc-generated-error')) {
      next.remove();
    }
  }

  var step1Form = document.querySelector('[data-rc-form="preferences"]');
  if (step1Form) {
    step1Form.addEventListener('submit', function (event) {
      var group = step1Form.querySelector('[data-rc-group="categories"]');
      var checked = group.querySelectorAll('input[type="checkbox"]:checked');
      if (checked.length === 0) {
        event.preventDefault();
        showError(group, 'Pick at least one investment type to continue.');
        group.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        clearError(group);
      }
    });
  }

  var step2Form = document.querySelector('[data-rc-form="contact"]');
  if (step2Form) {
    step2Form.addEventListener('submit', function (event) {
      var phone = step2Form.querySelector('#phone');
      var email = step2Form.querySelector('#email');
      var consent = step2Form.querySelector('#consent');
      var valid = true;

      var phonePattern = /^[0-9+\-\s().]{7,20}$/;
      if (!phonePattern.test(phone.value.trim())) {
        showError(phone, 'Enter a valid phone number.');
        valid = false;
      } else {
        clearError(phone);
      }

      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.value.trim())) {
        showError(email, 'Enter a valid email address.');
        valid = false;
      } else {
        clearError(email);
      }

      if (!consent.checked) {
        showError(consent.closest('.rc-consent'), 'Please check the box to continue.');
        valid = false;
      } else {
        clearError(consent.closest('.rc-consent'));
      }

      if (!valid) {
        event.preventDefault();
      }
    });
  }
})();
