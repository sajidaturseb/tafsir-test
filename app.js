(() => {
  'use strict';

  const surahs = Array.isArray(window.SURAH_DATA)
    ? [...window.SURAH_DATA].sort((a, b) => a.order - b.order) : [];
  const bySlug = new Map(surahs.map(item => [item.slug, item]));
  const tafsirFiles = {
    fatiha: 'fatiha-tafsir.md',
    mursalat: 'mursalat-tafsir.md',
    nas: 'nas-tafsir.md',
    ikhlas: 'ikhlas-tafsir.md',
    falaq: 'falaq-tafsir.md',
    naba: 'naba-tafsir.md'
  };
  const tafsirVerseCounts = {fatiha: 7, mursalat: 50, nas: 6, ikhlas: 4, falaq: 5, naba: 40};
  const params = new URLSearchParams(location.search);
  const requestedSlug = document.body.dataset.sura || params.get('sura');
  let current = bySlug.get(requestedSlug) || surahs[0];
  let reviewIndex = 0;
  let quizIndex = 0;
  let quizAnswers = [];
  let openText = '';
  let answerChecked = false;
  let startedAt = 0;
  let attemptId = '';
  let sent = false;
  const resultsEndpoint = 'https://kxwhwmxzmtvueksyayvz.supabase.co/functions/v1/submit-tafsir-quiz';

  const $ = id => document.getElementById(id);
  function fillGroupSelect(id, placeholder) {
    const select = $(id);
    select.add(new Option(placeholder, ''));
    const addBlock = (label, count, prefix = label) => {
      const block = document.createElement('optgroup');
      block.label = label;
      for (let number = 1; number <= count; number++) {
        const value = `${prefix} — ${number} группа`;
        block.append(new Option(value, value));
      }
      select.add(block);
    };
    for (let course = 1; course <= 4; course++) {
      addBlock(`${course} курс`, 8);
      addBlock(`Онлайн ${course} курс`, 10);
    }
    for (const direction of ['Дагват', 'Мәгърифәт', 'Остазлар']) {
      addBlock(`${direction}, 1 курс`, 3);
    }
    addBlock('Коръән уку мәктәбе', 10);
  }
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
      <a class="surah-card" href="surah-${encodeURIComponent(item.slug)}.html">
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
    document.querySelector('#intro .summary').textContent = tafsirFiles[current.slug]
      ? `Башта сүрәнең ${tafsirVerseCounts[current.slug]} аяте буенча мәгънә һәм аңлатманы укыгыз. Аннары сораулар аша кабатлап, тестны үтегез.`
      : `Бу эштә башта ${current.questions.length} сорау аша сүрәне кабатлыйсыз һәм әзер җавап белән үз фикерегезне чагыштырасыз. Аннары исемегезне язып, группагызны сайлап, тестны үтисез.`;
    $('startReviewBtn').textContent = tafsirFiles[current.slug] ? 'Сорауларга күчәргә' : 'Кабатлауны башларга';
    loadTafsir();
  }

  async function loadTafsir() {
    const host = $('tafsirText');
    if (!host) return;
    const file = tafsirFiles[current.slug];
    host.classList.toggle('hidden', !file);
    if (!file) return;
    host.textContent = 'Сүрә аңлатмасы йөкләнә…';
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error('tafsir_unavailable');
      renderTafsir(await response.text(), host);
    } catch {
      host.textContent = 'Аңлатманы йөкләп булмады. Битне яңартып карагыз.';
    }
  }

  function renderTafsir(markdown, host) {
    host.replaceChildren();
    let section = host;
    let ayah = null;
    for (const raw of markdown.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('# ')) continue;
      if (line.startsWith('## ')) {
        const sources = line === '## Чыганаклар';
        section = document.createElement('section');
        section.className = sources ? 'tafsir-sources' : 'tafsir-section';
        const heading = document.createElement('h2');
        heading.textContent = line.slice(3);
        section.append(heading);
        host.append(section);
        ayah = null;
      } else if (line.startsWith('### ')) {
        ayah = document.createElement('article');
        ayah.className = 'ayah-card';
        const heading = document.createElement('h3');
        heading.textContent = line.slice(4);
        ayah.append(heading);
        section.append(ayah);
      } else {
        const paragraph = document.createElement('p');
        const match = line.match(/^\*\*(Мәгънәсе|Аңлатма):\*\*\s*(.*)$/);
        if (match) {
          const label = document.createElement('strong');
          label.textContent = `${match[1]}: `;
          paragraph.append(label, document.createTextNode(match[2]));
        } else {
          paragraph.textContent = line;
        }
        (ayah || section).append(paragraph);
      }
    }
  }

  function lessonUrl() {
    const url = new URL(`surah-${encodeURIComponent($('teacherSurah').value)}.html`, document.baseURI);
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
    $('quizEyebrow').textContent = isOpen
      ? (current.slug === 'mursalat' ? 'Уйлану · Соңгы ачык сорау' : 'Гамәл · Соңгы ачык сорау')
      : `Белем · ${quizIndex + 1} нче сорау`;
    $('quizOptions').classList.toggle('hidden', isOpen);
    $('openWrap').classList.toggle('hidden', !isOpen);
    $('nextQuizBtn').textContent = isOpen ? 'Нәтиҗәне карарга' : 'Тикшерергә';
    if (isOpen) {
      $('quizQuestion').textContent = current.open;
      $('openAnswer').value = openText;
      $('openAnswer').placeholder = current.slug === 'mursalat'
        ? 'Сүрәдән алган гыйбрәтегезне үз сүзләрегез белән языгыз...'
        : 'Күркәм гамәл турында җавабыгыз...';
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
    $('sendResultBtn').disabled = false;
    $('sendResultBtn').classList.add('hidden');
    $('sendInstruction').innerHTML = '<strong>Сез тестны үттегез.</strong> Нәтиҗә укытучы журналына җибәрелә…';
    $('resultSendNote').textContent = '';
    show('result');
    void sendResult();
  }

  renderHome();
  applyCurrentSurah();
  if (!requestedSlug || !bySlug.has(requestedSlug)) $('coursePill').textContent = `${surahs.length} СҮРӘ`;
  fillGroupSelect('teacherGroup', 'Группу выберет ученик');
  fillGroupSelect('studentGroup', 'Выберите группу');
  const presetGroup = params.get('group') || '';
  if ([...$('studentGroup').options].some(option => option.value === presetGroup && presetGroup)) {
    $('studentGroup').value = presetGroup;
  }

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
  $('teacherGroup').addEventListener('change', () => {
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
      $('identityError').textContent = 'Исем-фамилияне языгыз һәм группаны сайлагыз.';
      $('identityError').classList.remove('hidden');
      return;
    }
    $('identityError').classList.add('hidden');
    quizIndex = 0;
    quizAnswers = Array(current.questions.length).fill(null);
    openText = '';
    startedAt = Date.now();
    attemptId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sent = false;
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

  async function sendResult() {
    const button = $('sendResultBtn');
    if (sent || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Җибәрелә…';
    $('resultSendNote').textContent = 'Нәтиҗә җибәрелә, бераз көтегез.';
    const score = current.questions.reduce((sum, item, index) => sum + Number(quizAnswers[index] === item.a), 0);
    const payload = {
      attemptId,
      studentName: $('studentName').value.trim(),
      group: $('studentGroup').value.trim(),
      surahSlug: current.slug,
      surahTitle: current.title,
      score,
      total: current.questions.length,
      durationSeconds: Math.min(86400, Math.max(1, Math.round((Date.now() - startedAt) / 1000))),
      answers: current.questions.map((item, index) => ({
        number: index + 1,
        selected: quizAnswers[index],
        correct: item.a,
        isCorrect: quizAnswers[index] === item.a
      })),
      openQuestion: current.open,
      openAnswer: openText
    };
    try {
      const response = await fetch(resultsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'send_failed');
      sent = true;
      button.textContent = 'Җибәрелде';
      $('sendInstruction').innerHTML = '<strong>Нәтиҗә җибәрелде.</strong> Ул укытучы журналында сакланды.';
      $('resultSendNote').textContent = 'Башка бернәрсә эшләргә кирәкми.';
      button.classList.add('hidden');
    } catch {
      button.disabled = false;
      button.textContent = 'Кабат җибәрергә';
      button.classList.remove('hidden');
      $('sendInstruction').innerHTML = '<strong>Нәтиҗә әлегә җибәрелмәде.</strong> Кабат җибәрү төймәсенә басыгыз.';
      $('resultSendNote').textContent = 'Нәтиҗә җибәрелмәде. Интернетны тикшереп, кабат басыгыз.';
    }
  }
  $('sendResultBtn').addEventListener('click', sendResult);

  $('retryBtn').addEventListener('click', () => {
    if (!sent && !confirm('Нәтиҗә әле укытучыга җибәрелмәде. Чыннан да кабат үтәргәме?')) return;
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
