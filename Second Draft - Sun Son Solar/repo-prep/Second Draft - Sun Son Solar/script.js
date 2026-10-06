document.addEventListener("DOMContentLoaded", () => {
  const choices = document.querySelectorAll(".segmented button");
  const department = document.getElementById("department");
  const setAccountType = (button) => {
    const associate = button.textContent.trim().toUpperCase() === "ASSOCIATE";
    document.body.classList.toggle("associate-mode", associate);
    const accountType = document.getElementById("accountType");
    if (accountType) accountType.value = associate ? "Associate" : "Client";
    if (department) department.required = associate;
  };
  choices.forEach((button) =>
    button.addEventListener("click", () => {
      choices.forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      setAccountType(button);
    }),
  );
  const selectedType = document.querySelector(".segmented button.selected");
  if (selectedType) setAccountType(selectedType);
  const toggle = document.getElementById("showPassword");
  if (toggle)
    toggle.addEventListener("click", () => {
      const field = document.getElementById("password");
      field.type = field.type === "password" ? "text" : "password";
      const visible = field.type === "text";
      toggle.setAttribute("aria-pressed", String(visible));
      toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    });
  const login = document.getElementById("loginSwitch");
  if (login)
    login.addEventListener("click", () => {
      document.body.classList.toggle("login-mode");
      const mode = document.body.classList.contains("login-mode");
      document.getElementById("formTitle").textContent = mode
        ? "Welcome Back"
        : "Create Your Account";
      document.getElementById("formSubtitle").textContent = mode
        ? "Log in to continue with your Sun Son Solar account."
        : "Enter your information to get started with Sun Son Solar.";
      document.getElementById("submitButton").textContent = mode
        ? "Log In"
        : "Create Account";
      document.getElementById("formSwitch").innerHTML = mode
        ? 'New to Sun Son Solar? <button type="button" id="loginSwitch">Create an account</button>'
        : 'Already have an account? <button type="button" id="loginSwitch">Log in</button>';
      document
        .getElementById("loginSwitch")
        .addEventListener("click", () => location.reload());
    });
  const form = document.getElementById("accountForm");
  if (form) {
    const birthdate = document.getElementById("birthdate");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");
    const validCalendarDate = (value) => {
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
      if (!match) return false;
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const parsed = new Date(year, month - 1, day);
      return (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      );
    };
    const updateDateValidity = () => {
      birthdate.setCustomValidity(
        birthdate.value && !validCalendarDate(birthdate.value)
          ? "Enter a real calendar date in DD/MM/YYYY format."
          : "",
      );
    };
    const updatePasswordMatch = () => {
      confirmPassword.setCustomValidity(
        confirmPassword.value && confirmPassword.value !== password.value
          ? "Passwords do not match."
          : "",
      );
    };
    birthdate.addEventListener("input", updateDateValidity);
    password.addEventListener("input", updatePasswordMatch);
    confirmPassword.addEventListener("input", updatePasswordMatch);
    form.addEventListener("submit", (event) => {
      updateDateValidity();
      updatePasswordMatch();
      if (!form.reportValidity()) event.preventDefault();
    });
  }
});
