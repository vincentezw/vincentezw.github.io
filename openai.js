window.vincentOpenAI = (function() {
  const language = {
    answer: 'Answer: ',
    noInput: 'Please enter some input',
    question: 'Question: ',
    submit: 'Submit'
  },

  selectors = {
    apiButton: 'vincent-openai__api-code',
    clearButton: 'vincent-openai__results-clear',
    errorSpan: 'vincent-openai__error',
    inputText: 'vincent-openai__prompt',
    resultsWrapper: 'vincent-openai__results-wrapper',
    resultAnswer: 'vincent-openai__result--answer',
    resultHeading: 'vincent-openai__result--heading',
    resultPrompt: 'vincent-openai__result--prompt',
    submitButton: 'vincent-openai__submit',
    suggestion: 'vincent-openai__prompt-suggestion',
  },

  settings = {
    frequency_penalty: 1, // the higher the number, the less likely a repeat answer, 0-1
    max_tokens: 64, // max completion length
    presence_penalty: 1, // the higher, the more effort is put into new topics
    temperature: 0.5, // creative risk, between 0-1
  },

  changeApiCode = () => {
    const apiCode = prompt('Enter API code', sessionStorage.getItem('vincent-openai__key'));
    sessionStorage.setItem('vincent-openai__key', code);
    return apiCode;
  },

  clearError = () => {
    const errorSpan = document.querySelector(`.${selectors.errorSpan}`);
    errorSpan.dataset.toggled = false,
    errorSpan.dataset.showError = false;
  },

  // clear displayed results and empty storage
  clearResults = () => {
    const resultsWrapper = document.querySelector(`.${selectors.resultsWrapper}`),
          results = resultsWrapper.getElementsByTagName('details');
    Array.from(results).forEach((result) => result.remove());
    resultsWrapper.dataset.results = false;
    sessionStorage.removeItem('vincent-openai__answers');
  },

  getResults = async (query) => {
    const data = {
      prompt: query,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      frequency_penalty: settings.frequency_penalty,
      presence_penalty: settings.presence_penalty,
    };

    const apiCode = !!sessionStorage.getItem('vincent-openai__key')
      ? sessionStorage.getItem('vincent-openai__key')
      : changeApiCode();

    const results = await fetch("https://api.openai.com/v1/engines/text-curie-001/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiCode}`,
      },
      body: JSON.stringify(data),
    })
    .then(response => {
      if (response.status !== 200) {
        const errorCode = response.status === 401
          ? `${response.status} - check API code`
          : response.status;
        throw new Error(errorCode);
        return;
      }
      return response.json()
    })
    .catch((error) => {
      console.error('Error:', error);
      showError(error);
    });

    return results;
  },

  init = () => {
    const apiButtons = document.getElementsByClassName(selectors.apiButton),
          clearButtons = document.getElementsByClassName(selectors.clearButton),
          errorSpan = document.querySelector(`.${selectors.errorSpan}`),
          submitButton = document.querySelector(`.${selectors.submitButton}`),
          suggestions = document.getElementsByClassName(selectors.suggestion),
          textArea = document.querySelector(`.${selectors.inputText}`);

    // prefill the query if previously entered
    textArea.value = sessionStorage.getItem('vincent-openai__query');
    // render previous answers
    restoreFromStorage();
    // restore last submitted prompt value
    textArea.addEventListener('beforeinput', clearError);

    // remove our animation trigger when animation has completed on error, so it can be triggered again
    errorSpan.addEventListener('animationend', () => errorSpan.dataset.toggled = false);

    Array.from(suggestions).forEach((suggestion)=> {
      suggestion.addEventListener('click', () => textArea.value = suggestion.textContent);
    });

    Array.from(apiButtons).forEach((button) => button.addEventListener('click', changeApiCode));

    Array.from(clearButtons).forEach((button) => button.addEventListener('click', clearResults));

    submitButton.addEventListener('click', (event) => {
      event.preventDefault();
      setSpinner(submitButton, true);
      clearError();
      const input = textArea.value;
      if (input === '') { 
        showError(language.noInput);
        setSpinner(submitButton, false);
        textArea.focus();
        return;
      }

      sessionStorage.setItem('vincent-openai__query', input);
      getResults(input)
      .then((results) => renderResults(results, input))
      .then(() => setSpinner(submitButton, false));
    })
  },

  insertAfter = (newNode, existingNode) => { existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling) },

  // render result(s) as returned from the API
  renderResults = (results, question) => {
    const fragment = document.createDocumentFragment(),
          resultsWrapper = document.querySelector(`.${selectors.resultsWrapper}`),
          firstClearButton = resultsWrapper.querySelector(`.${selectors.clearButton}`);

    if (!results || !results.choices || results.choices.length === 0) { return; }

    // alter the data attribute of our wrapper to display heading
    resultsWrapper.dataset.results = true;

    results.choices.forEach((answer) => {
      const container = renderSingleResult(question, answer.text);
      fragment.appendChild(container);

      // save question and answer to sessionstorage
      saveToSession(question, answer.text);
    });

    insertAfter(fragment, firstClearButton);

    // hightlight the opened answer
    const newNode = resultsWrapper.querySelector('details');
    newNode.open = true;
    newNode.dataset.new = true;
  },

  // create a single details disclose element holding the question and answer
  renderSingleResult = (question, answer) => {
    const answerElement = document.createElement('div'),
          answerHeading = document.createElement('span'),
          answerText = document.createTextNode(answer),
          details = document.createElement('details'),
          promptElement = document.createElement('summary'),
          promptHeading = document.createElement('span'),
          promptText = document.createTextNode(question);
    
    promptElement.classList.add(selectors.resultPrompt),
    answerElement.classList.add(selectors.resultAnswer),
    answerHeading.classList.add(selectors.resultHeading),
    promptHeading.classList.add(selectors.resultHeading),
    answerHeading.textContent = language.answer,
    promptHeading.textContent = language.question,
    promptElement.appendChild(promptHeading),
    promptElement.appendChild(promptText),
    answerElement.appendChild(answerHeading),
    answerElement.appendChild(answerText),
    details.appendChild(promptElement),
    details.appendChild(answerElement),
    details.open = false;
    return details;
  },

  // render results from previously stored data
  restoreFromStorage = () => {
    const existingData = sessionStorage.getItem('vincent-openai__answers');
    if (!existingData) { return; }

    // need to reverse object to display newest first
    const formattedData = JSON.parse(`[${existingData}]`).reverse(),
          fragment = document.createDocumentFragment()
          resultsWrapper = document.querySelector(`.${selectors.resultsWrapper}`),
          firstClearButton = resultsWrapper.querySelector(`.${selectors.clearButton}`);

    // alter the data attribute of our wrapper to display heading
    resultsWrapper.dataset.results = true;

    Object.entries(formattedData).forEach(([key, value]) => {
      const container = renderSingleResult(value.question, value.answer);
      fragment.appendChild(container);
    });

    insertAfter(fragment, firstClearButton);
  },

  // save a question and its answer to the browsers sessionstorage
  saveToSession = (question, answer) => {
    const existingData = sessionStorage.getItem('vincent-openai__answers');
    const newData = JSON.stringify({
      question: question,
      answer: answer
    });

    // store combined array if there is previous data present
    const toStore = !!existingData ? `${existingData},${newData}` : newData;
    sessionStorage.setItem('vincent-openai__answers', toStore);
  },

  // set a button's label with a spinner and disable it, or restore text and enable
  setSpinner = (button, state) => {
    button.disabled = state;
    button.innerHTML = state
      ? `<svg class="vincent-openai__spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`
      : language.submit;
  },

  // show an error message and highlight it
  showError = (text) => {
    const errorSpan = document.querySelector(`.${selectors.errorSpan}`);
    // this data attribute triggers the flash animation
    errorSpan.dataset.toggled = true,
    errorSpan.textContent = text,
    errorSpan.dataset.showError = true,
    errorSpan.focus();
  };
    
  return init;
})();

window.addEventListener('DOMContentLoaded', vincentOpenAI);