(() => {
  'use strict';

  const surahs = Array.isArray(window.SURAH_DATA) ? window.SURAH_DATA : [];
  const bySlug = new Map(surahs.map(item => [item.slug, item]));
  const params = new URLSearchParams(location.search);
  const requestedSlug = params.get('sura');
  let current = bySlug.get(requestedSlug) || surahs[0];
  let reviewIndex = 0;
  let quizIndex = 0;
  let quizAnswers = [];
  let openText = '';
  let answerChecked = false;

  const $ = id => document.getElementById(id);
  const screens = ['home', 'intro', 'review', 'identity', 'quiz', 'result'];
  const stageNames = {
    intro: 'Дәрес белән танышу',
    review: 'Сораулар аша кабатлау',
    identity: 'Укучы турында мәгълүмат',
    quiz: 'Белемне тикшерү',
    result: 'Эш тәмамланды'
  };
  const stageNumbers = {intro: 1, review: 2, identity: 3, quiz: 4, result: 5};

  function show(id) {
    screens.forEach(screen => $(screen).classList.toggle('hidden', screen !== id));
    const staged = id !== 'home';
    $('stagebar').classList.toggle('hidden', !staged);
    if (staged) {
      const number = stageNumbers[id];
      $('stageName').textContent = stageNames[id];
      $('stageCount').textContent = `${number} / 5`;
      $('stageProgress').style.width = `${number * 20}%`;
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function renderHome() {
    const list = document.querySelector('.surah-list');
    list.innerHTML = surahs.map(item => `
      <a class="surah-card" href="?sura=${encodeURIComponent(item.slug)}">
        <span class="num">${item.order}</span>
        <span><strong>${item.title}</strong><span>${item.subtitle}</span></span>
        <span class="go">Ачарга</span>
      </a>`).join('');
    $('teacherSurah').innerHTML = surahs.map(item =>
      `<option value="${item.slug}">${item.order}. ${item.title}</option>`
    ).join('');
    $('teacherSurah').value = current.slug;
  }

  function applyCurrentSurah() {
    document.title = `${current.title} буенча белемне тикшерү`;
    $('coursePill').textContent = current.title.toUpperCase();
    document.querySelector('#intro h1').textContent = current.title;
    document.querySelector('#intro .lead').textContent = current.subtitle;
    document.querySelector('#intro .summary').textContent =
      `Бу эштә башта ${current.questions.length} сорау аша сүрәне кабатлыйсыз һәм әзер җавап белән үз фикерегезне чагыштырасыз. Аннары исемегезне һәм төркемегезне язып, тестны үтисез.`;
  }

  function lessonUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('sura', $('teacherSurah').value);
    const group = $('teacherGroup').value.trim();
    if (group) url.searchParams.set('group', group);
    return url.toString();
  }

  function renderReview() {
    const item = current.questions[reviewIndex];
    $('reviewCounter').textContent = `${reviewIndex + 1} / ${current.questions.length}`;
    $('reviewQuestion').textContent = `${reviewIndex + 1}. ${item.q}`;
    $('reviewAnswerText').textContent = `${item.o[item.a]}. ${item.basis}`;
    $('reviewAnswer').classList.add('hidden');
    $('showAnswerBtn').classList.remove('hidden');
    $('nextReviewBtn').classList.add('hidden');
    $('nextReviewBtn').textContent = reviewIndex === current.questions.length - 1 ? 'Тестка әзерләнергә' : 'Киләсе сорау';
  }

  function renderQuiz() {
    const isOpen = quizIndex === current.questions.length;
    answerChecked = false;
    $('quizError').classList.add('hidden');
    $('quizFeedback').classList.add('hidden');
    $('quizEyebrow').textContent = isOpen ? 'Гамәл · Соңгы ачык сорау' : `Белем · ${quizIndex + 1} нче сорау`;
    $('quizOptions').classList.toggle('hidden', isOpen);
    $('openWrap').classList.toggle('hidden', !isOpen);
    $('nextQuizBtn').textContent = isOpen ? 'Җавапларны җибәрергә' : 'Тикшерергә';
    if (isOpen) {
      $('quizQuestion').textContent = current.open;
      $('openAnswer').value = openText;
      return;
    }
    const item = current.questions[quizIndex];
    const letters = ['А', 'Б', 'В'];
    $('quizQuestion').textContent = item.q;
    $('quizOptions').innerHTML = item.o.map((option, index) => `
      <label class="option">
        <input type="radio" name="choice" value="${index}">
        <span class="letter">${letters[index]}</span><span>${option}</span>
      </label>`).join('');
  }

  function finish() {
    const correct = current.questions.reduce((sum, item, index) => sum + (quizAnswers[index] === item.a ? 1 : 0), 0);
    const mistakes = current.questions.length - correct;
    $('scoreText').textContent = `${correct} / ${current.questions.length}`;
    $('mistakeText').textContent = mistakes;
    $('resultText').textContent = `${$('studentName').value.trim()} · ${$('studentGroup').value.trim()}. Нәтиҗә һәм ачык җавап бу биттә күрсәтелә.`;
    $('openPreview').textContent = openText;
    show('result');
  }

  renderHome();
  applyCurrentSurah();
  if (!requestedSlug || !bySlug.has(requestedSlug)) $('coursePill').textContent = `${surahs.length} СҮРӘ`;
  $('studentGroup').value = params.get('group') || '';

  $('copyLinkBtn').addEventListener('click', () => {
    const link = lessonUrl();
    $('teacherLink').value = link;
    $('teacherLink').classList.remove('hidden');
    $('copyNote').textContent = 'Сылтама әзер. Астагы юлдан күчереп алырга мөмкин.';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        $('copyNote').textContent = 'Сылтама күчереп алынды.';
      }).catch(() => {});
    }
  });

  $('teacherSurah').addEventListener('change', () => {
    current = bySlug.get($('teacherSurah').value) || current;
    $('teacherLink').classList.add('hidden');
    $('copyNote').textContent = '';
  });
  $('teacherGroup').addEventListener('input', () => {
    $('teacherLink').classList.add('hidden');
    $('copyNote').textContent = '';
  });

  $('startReviewBtn').addEventListener('click', () => {
    reviewIndex = 0;
    renderReview();
    show('review');
  });
  $('showAnswerBtn').addEventListener('click', () => {
    $('reviewAnswer').classList.remove('hidden');
    $('showAnswerBtn').classList.add('hidden');
    $('nextReviewBtn').classList.remove('hidden');
  });
  $('nextReviewBtn').addEventListener('click', () => {
    if (reviewIndex < current.questions.length - 1) {
      reviewIndex += 1;
      renderReview();
      window.scrollTo({top: 0, behavior: 'smooth'});
    } else {
      show('identity');
    }
  });

  $('startTestBtn').addEventListener('click', () => {
    const name = $('studentName').value.trim();
    const group = $('studentGroup').value.trim();
    if (!name || !group) {
      $('identityError').textContent = 'Исем-фамилия һәм төркем юлларын тутырыгыз.';
      $('identityError').classList.remove('hidden');
      return;
    }
    $('identityError').classList.add('hidden');
    quizIndex = 0;
    quizAnswers = Array(current.questions.length).fill(null);
    openText = '';
    renderQuiz();
    show('quiz');
  });

  $('nextQuizBtn').addEventListener('click', () => {
    if (quizIndex < current.questions.length) {
      if (answerChecked) {
        quizIndex += 1;
        renderQuiz();
        window.scrollTo({top: 0, behavior: 'smooth'});
        return;
      }
      const chosen = document.querySelector('input[name="choice"]:checked');
      if (!chosen) {
        $('quizError').textContent = 'Тикшерү өчен бер җавапны сайлагыз.';
        $('quizError').classList.remove('hidden');
        return;
      }
      const selected = Number(chosen.value);
      const item = current.questions[quizIndex];
      const isCorrect = selected === item.a;
      quizAnswers[quizIndex] = selected;
      answerChecked = true;
      document.querySelectorAll('.option').forEach((option, index) => {
        option.classList.add('locked');
        option.querySelector('input').disabled = true;
        if (index === item.a) option.classList.add('correct');
        if (index === selected && !isCorrect) option.classList.add('wrong');
      });
      $('quizFeedback').className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
      $('feedbackTitle').textContent = isCorrect ? 'Дөрес җавап!' : 'Бу җавап дөрес түгел.';
      $('feedbackText').textContent = isCorrect
        ? item.basis
        : `Дөрес җавап: ${item.o[item.a]}. ${item.basis}`;
      $('nextQuizBtn').textContent = 'Алга';
      $('quizError').classList.add('hidden');
      return;
    }
    openText = $('openAnswer').value.trim();
    if (!openText) {
      $('quizError').textContent = 'Соңгы сорауга җавап языгыз.';
      $('quizError').classList.remove('hidden');
      return;
    }
    finish();
  });

  $('retryBtn').addEventListener('click', () => {
    reviewIndex = 0;
    quizIndex = 0;
    quizAnswers = [];
    openText = '';
    $('openAnswer').value = '';
    show('intro');
  });

  if (requestedSlug && bySlug.has(requestedSlug)) show('intro');
  else show('home');
})();
