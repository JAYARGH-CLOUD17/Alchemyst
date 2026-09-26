const tabs = document.querySelectorAll(".tab");

const associateName =
  document.getElementById("associateName");

const departmentField =
  document.getElementById("departmentField");

const form =
  document.getElementById("registrationForm");
const accountTypeInput =
  document.getElementById("accountType");

const phone =
  document.getElementById("phone");

let accountType = "client";


phone.addEventListener("input", function () {

  this.value =
    this.value.replace(/[^0-9]/g, "");

  if (this.value.length > 11) {
    this.value =
      this.value.substring(0, 11);
  }

});


phone.addEventListener("keydown", function (event) {

  const allowedKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End"
  ];

  if (
    allowedKeys.includes(event.key) ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }

  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault();
  }

  if (
    /^[0-9]$/.test(event.key) &&
    this.value.length >= 11
  ) {
    event.preventDefault();
  }

});


function getRequiredFields() {

  let fields = [
    "firstName",
    "middleName",
    "lastName",
    "birthdate",
    "gender",
    "email",
    "phone",
    "address",
    "username",
    "password",
    "confirmPassword"
  ];

  if (accountType === "associate") {
    fields.push("department");

  }

  return fields;

}


tabs.forEach(tab => {

  tab.addEventListener("click", () => {

    accountType =
      tab.dataset.type;
    accountTypeInput.value = accountType;

    tabs.forEach(item => {
      item.classList.remove("active");
    });

    tab.classList.add("active");

    associateName.classList.remove("active");
    departmentField.classList.toggle("active", accountType === "associate");
    clearErrors();

  });

});


function clearErrors() {

  document
    .querySelectorAll(".error-message")
    .forEach(error => {
      error.remove();
    });

  document
    .querySelectorAll(".input-error")
    .forEach(input => {
      input.classList.remove("input-error");
    });

}


function showError(field, message) {

  field.classList.add("input-error");

  const existingError =
    field.parentElement.querySelector(
      ".error-message"
    );

  if (existingError) {
    return;
  }

  const error =
    document.createElement("div");

  error.className =
    "error-message";

  error.textContent =
    message;

  field.parentElement.appendChild(error);

}


form.addEventListener(
  "submit",
  function (event) {

    event.preventDefault();

    let isValid = true;

    clearErrors();

    const requiredFields =
      getRequiredFields();

    requiredFields.forEach(fieldId => {

      const field =
        document.getElementById(fieldId);

      if (!field) {
        return;
      }

      if (field.value.trim() === "") {

        isValid = false;

        showError(
          field,
          "This field is required."
        );

      }

    });


    const email =
      document.getElementById("email");

    if (
      email.value.trim() !== "" &&
      !email.validity.valid
    ) {

      isValid = false;

      showError(
        email,
        "Please enter a valid email address."
      );

    }


    const username =
      document.getElementById("username");

    if (
      username.value.trim() !== "" &&
      (
        username.value.length < 8 ||
        username.value.length > 12
      )
    ) {

      isValid = false;

      showError(
        username,
        "Username must be 8-12 characters."
      );

    }


    const password =
      document.getElementById("password");

    if (
      password.value.trim() !== "" &&
      (
        password.value.length < 8 ||
        password.value.length > 16
      )
    ) {

      isValid = false;

      showError(
        password,
        "Password must be 8-16 characters."
      );

    }


    const confirmPassword =
      document.getElementById(
        "confirmPassword"
      );

    if (
      password.value !== "" &&
      confirmPassword.value !== "" &&
      password.value !== confirmPassword.value
    ) {

      isValid = false;

      showError(
        confirmPassword,
        "Passwords do not match."
      );

    }


    if (
      phone.value.trim() !== "" &&
      !/^09\d{9}$/.test(
        phone.value.trim()
      )
    ) {

      isValid = false;

      showError(
        phone,
        "Enter a valid Philippine mobile number."
      );

    }


    const birthdate =
      document.getElementById("birthdate");

    if (birthdate.value !== "") {

      const selectedDate =
        new Date(birthdate.value);

      const today =
        new Date();

      today.setHours(0, 0, 0, 0);

      if (selectedDate > today) {

        isValid = false;

        showError(
          birthdate,
          "Birthdate cannot be in the future."
        );

      }

    }


    if (!isValid) {

      const firstError =
        document.querySelector(
          ".input-error"
        );

      if (firstError) {

        firstError.focus();

        firstError.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

      }

      return;

    }


    form.submit();

  }
);


form.addEventListener(
  "input",
  function (event) {

    const field =
      event.target;

    if (
      field.tagName !== "INPUT" &&
      field.tagName !== "TEXTAREA" &&
      field.tagName !== "SELECT"
    ) {
      return;
    }

    if (field.value.trim() !== "") {

      field.classList.remove(
        "input-error"
      );

      const error =
        field.parentElement.querySelector(
          ".error-message"
        );

      if (error) {
        error.remove();
      }

    }

  }
);


form.addEventListener(
  "change",
  function (event) {

    const field =
      event.target;

    if (
      field.tagName !== "SELECT" &&
      field.type !== "date"
    ) {
      return;
    }

    if (field.value !== "") {

      field.classList.remove(
        "input-error"
      );

      const error =
        field.parentElement.querySelector(
          ".error-message"
        );

      if (error) {
        error.remove();
      }

    }

  }
);
