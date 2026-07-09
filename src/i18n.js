// Player-facing strings in English and Azerbaijani. The language is chosen on
// first launch and remembered separately from the save (?reset keeps it).

const STRINGS = {
  en: {
    subtitle: '— After Curfew —',
    controls: '<span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> walk'
      + ' &nbsp;·&nbsp; <span class="key">Shift</span> run &nbsp;·&nbsp; <span class="key">Space</span> jump'
      + ' &nbsp;·&nbsp; mouse to look<br/>'
      + '<span class="key">1</span>–<span class="key">6</span> and <span class="key">0</span> choose a spell &nbsp;·&nbsp; '
      + '<span class="key">Click</span> cast &nbsp;·&nbsp; <span class="key">E</span> open doors &nbsp;·&nbsp; <span class="key">M</span> the Map',
    enterhint: 'Click to sneak in',
    fineprint: 'A fan-made tribute for private fun. Best played in Chrome with sound on.',
    paused: 'Paused — click to resume',
    objhead: 'Objective',
    sortTitle: 'THE SORTING HAT',
    sortQuote: '“Hmm… difficult. VERY difficult. Plenty of courage, I see. Where shall I put you?”',
    trait0: 'the brave', trait1: 'the cunning', trait2: 'the wise', trait3: 'the loyal',
    hatpick: 'Let the Hat decide…',
    hatcry: '“{house}!” cries the Hat — and the castle swallows the echo. It sleeps…',
    sleeps: 'The courtyard is deserted. The castle sleeps…',
    mouseFallback: 'Mouse capture unavailable — the view follows your mouse instead.',

    q0: 'Cross the courtyard to the <b>Castle Gate</b>. It’s locked — select <b>Alohomora</b> [3] and click while looking at it.',
    q0_done: 'The great oak doors groan inward. You’re in.',
    q1: 'Slip inside and find the <b>Great Hall</b> — the tall double doors on the <b>left</b> of the Entrance Hall. Press <span style="color:#ffe9a8">[E]</span> to open doors.',
    q1_done: 'A thousand candles float beneath a sky that isn’t there.',
    q2: 'When you’ve had your fill of the candles, head back and take the <b>dungeon stairs</b> — the low opening to the <b>right</b> of the Grand Staircase — and go down.',
    q2_done: 'The air turns cold and damp. Something is down here.',
    q3: 'You can barely see your own hands. Cast <b>Lumos</b> [1] to light your wand. (<b>Nox</b> [2] snuffs it out.)',
    q3_done: 'Wandlight washes over dripping stone… and long, barred cells.',
    q4: 'That creeping, hollow cold — a <b>Dementor</b> is hunting you! Face it and cast <b>Expecto Patronum</b> [0]. Don’t let it touch you!',
    q4_done: 'Your silver stag drives the darkness away. You did it!',
    q5: 'You’ve mastered the great charms! ⚡ For extra credit: unlock the <b>Charms Classroom</b> (east corridor) and the <b>Potions Store</b> (dungeon’s end), light candles and sconces with <b>Incendio</b> [4] — and douse them with <b>Aguamenti</b> [5].',
    q5_done: 'Every door in the castle stands open to you. Sleep well, wizard.',
    q6: '⚡ Every door stands open. Explore as long as you like — the candles never burn down.',

    dementorFaint: 'You fainted… Madam Pomfrey levitated you to safety and fed you chocolate.',
    banish: 'The Dementor shreds apart with a distant shriek!',
    norrisSpotted: 'Mrs. Norris’s lamp-like eyes flash — a yowl echoes down the corridor. Filch is coming! Outrun him — or melt into the dark.',
    filchCaught: 'Caught! Filch: “Students out of bed! Twenty points from {house}!”',
    filchLost: 'You’ve given Filch the slip… for now.',
    unlockClassroom: 'The Charms classroom — empty desks, waiting chalk.',
    unlockPotions: 'Snape’s potion store! Best not touch anything… much.',
    mapOpen: '“I solemnly swear that I am up to no good.”',
    mapClose: '“Mischief managed.”',

    lumosAlready: 'Your wand is already alight.',
    lumosOn: 'Lumos! A cold, steady light blooms at your wand-tip.',
    noxAlready: 'Your wand is already dark.',
    noxOff: 'Nox. The light dies.',
    alohomoraUnlock: 'Alohomora! The {door} clicks open.',
    alohomoraAlready: 'The {door} is already unlocked — press E to open it.',
    alohomoraFizzle: 'The charm fizzles — nothing to unlock there.',
    patronusWait: 'You need a moment to gather a happy memory…',
    patronusCast: 'EXPECTO PATRONUM! A silver stag erupts from your wand!',
    incendioLight: 'Incendio! Flames leap to life.',
    incendioBurning: 'That flame is already burning merrily.',
    incendioStone: 'The spell scorches bare stone. Aim at unlit candles or torch sconces.',
    incendioDark: 'A lick of flame curls into the dark and dies.',
    aguamentiDouse: 'Aguamenti! The flames hiss out in a puff of steam.',
    aguamentiNothing: 'Nothing is burning there.',
    aguamentiSplash: 'A jet of water splashes over the stone.',
    leviosaJoke: 'Wingardium Levi-O-sa! (“It’s Levi-O-sa, not Levio-SA.”)',
    leviosaFloat: 'Wingardium Leviosa! The {name} floats.',
    leviosaNothing: 'Nothing light enough to levitate there. (Try a crate, book, goblet, or the potion bottles.)',
    leviosaDown: 'You let it drift gently down.',
    doorBudge: 'The {door} won’t budge. Perhaps a charm would help… [3]',
    promptLocked: '{door} — <i>locked</i>. Try <b>Alohomora</b> [3]',
    promptOpen: '<span class="key">E</span> Open {door}',
    promptClose: '<span class="key">E</span> Close {door}',

    door_gate: 'Castle Gate',
    door_hall: 'Great Hall Doors',
    door_classroom: 'Charms Classroom',
    door_potions: 'Potions Store',
    item_crate: 'crate', item_book: 'book', item_goblet: 'goblet', item_flask: 'flask', item_bottle: 'bottle',

    hintMap: 'Something rustles in your pocket — old parchment, swearing in faded ink that it is up to no good. [M]',
    hintCat: 'Eyes flash low in the dark ahead. Cats hunt by light — a lit wand is a lantern to them. Nox, perhaps?',
    hintLeviosa: 'The castle leaves things lying about — a swish and a flick would lift them. [6]',
    hintPoints: '(The hourglasses in the Entrance Hall keep the count. Gems rise with good work — and drain for mischief.)',
    hintRoom: 'Between the sconces, one stretch of wall feels… expectant. As though it wonders whether you’ll walk past again.',
    roomReveal: 'The stone ripples — and a door that was never there politely appears.',
    cloakFound: 'Beneath the dust: a cloak woven of something like moonlight. Press C to disappear. (Dementors, mind, do not hunt with eyes.)',
    cloakOnCap: 'You melt from sight.',
    cloakOffCap: 'You shrug the cloak from your shoulders.',
    door_room: 'Room of Requirement',
  },

  az: {
    subtitle: '— Komendant saatından sonra —',
    controls: '<span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> yeri'
      + ' &nbsp;·&nbsp; <span class="key">Shift</span> qaç &nbsp;·&nbsp; <span class="key">Space</span> tullan'
      + ' &nbsp;·&nbsp; baxmaq üçün siçan<br/>'
      + '<span class="key">1</span>–<span class="key">6</span> və <span class="key">0</span> sehr seç &nbsp;·&nbsp; '
      + '<span class="key">Click</span> sehri at &nbsp;·&nbsp; <span class="key">E</span> qapılar &nbsp;·&nbsp; <span class="key">M</span> Xəritə',
    enterhint: 'Gizlicə girmək üçün kliklə',
    fineprint: 'Şəxsi əyləncə üçün fanat işi. Chrome-da, səsi açıq oynamaq məsləhətdir.',
    paused: 'Fasilə — davam etmək üçün kliklə',
    objhead: 'Tapşırıq',
    sortTitle: 'SEÇİM PAPAĞI',
    sortQuote: '“Hmm… çətindir. ÇOX çətindir. Cəsarətin boldur, görürəm. Səni hara qoyum?”',
    trait0: 'cəsurlar', trait1: 'hiyləgərlər', trait2: 'müdriklər', trait3: 'sadiqlər',
    hatpick: 'Qoy Papaq özü seçsin…',
    hatcry: '“{house}!” — deyə Papaq qışqırır, qala isə əks-sədanı udur. O yatır…',
    sleeps: 'Həyət bomboşdur. Qala yatır…',
    mouseFallback: 'Siçanı tutmaq mümkün olmadı — görünüş siçanın hərəkətini izləyəcək.',

    q0: 'Həyəti keçib <b>Qala Darvazasına</b> yaxınlaş. Bağlıdır — <b>Alohomora</b>-nı seç [3] və darvazaya baxaraq kliklə.',
    q0_done: 'Nəhəng palıd qapılar inildəyərək içəri açılır. Artıq içəridəsən.',
    q1: 'İçəri süzül və <b>Böyük Zalı</b> tap — Giriş Zalının <b>solundakı</b> hündür qoşa qapılar. Qapıları açmaq üçün <span style="color:#ffe9a8">[E]</span> bas.',
    q1_done: 'Min şam, əslində orada olmayan bir səmanın altında süzülür.',
    q2: 'Şamlardan doyandan sonra geri qayıt və <b>zindan pilləkənlərini</b> tap — Böyük Pilləkənin <b>sağındakı</b> alçaq keçid — və aşağı düş.',
    q2_done: 'Hava soyuqlaşır, nəmlənir. Aşağıda nəsə var.',
    q3: 'Öz əllərini belə görə bilmirsən. Əsanı yandır: <b>Lumos</b> [1]. (<b>Nox</b> [2] söndürür.)',
    q3_done: 'Əsa işığı damcılayan daşları… və uzun, barmaqlıqlı kameraları işıqlandırır.',
    q4: 'O sürünən, boş soyuqluq — <b>Dementor</b> səni ovlayır! Üzünə bax və <b>Expecto Patronum</b> [0] at. Sənə toxunmasına imkan vermə!',
    q4_done: 'Gümüş maralın qaranlığı qovdu. Bacardın!',
    q5: 'Böyük sehrləri mənimsədin! ⚡ Əlavə bal üçün: <b>Sehrlər Sinfini</b> (şərq dəhlizi) və <b>İksir Anbarını</b> (zindanın sonu) aç, şamları və məşəlləri <b>Incendio</b> [4] ilə yandır — <b>Aguamenti</b> [5] ilə söndür.',
    q5_done: 'Qalanın bütün qapıları üzünə açıqdır. Şirin yuxular, sehrbaz.',
    q6: '⚡ Bütün qapılar açıqdır. İstədiyin qədər gəz — şamlar heç vaxt sönmür.',

    dementorFaint: 'Huşunu itirdin… Madam Pomfri səni təhlükəsiz yerə apardı və şokolad yedirtdi.',
    banish: 'Dementor uzaqdan gələn çığırtı ilə parça-parça olur!',
    norrisSpotted: 'Missis Norrisin çıraq kimi gözləri parıldayır — dəhlizdə miyoltu əks-səda verir. Filç gəlir! Ondan qaç — ya da qaranlıqda ərİyib yox ol.',
    filchCaught: 'Tutuldun! Filç: “Yataqdan kənar şagirdlər! {house}-dan iyirmi bal!”',
    filchLost: 'Filçin əlindən qurtuldun… hələlik.',
    unlockClassroom: 'Sehrlər sinfi — boş partalar, gözləyən təbaşir.',
    unlockPotions: 'Sneypin iksir anbarı! Heç nəyə toxunmasan yaxşıdır… çox da yox.',
    mapOpen: '“And içirəm ki, niyyətim yaxşı deyil.”',
    mapClose: '“Fitnə tamamlandı.”',

    lumosAlready: 'Əsan onsuz da yanır.',
    lumosOn: 'Lumos! Əsanın ucunda soyuq, sabit bir işıq açılır.',
    noxAlready: 'Əsan onsuz da qaranlıqdır.',
    noxOff: 'Nox. İşıq sönür.',
    alohomoraUnlock: 'Alohomora! {door} tıqqıltı ilə açılır.',
    alohomoraAlready: '{door} onsuz da açıqdır — açmaq üçün E bas.',
    alohomoraFizzle: 'Sehr fısıldayıb sönür — orada açılası heç nə yoxdur.',
    patronusWait: 'Xoşbəxt bir xatirəni toplamaq üçün bir an lazımdır…',
    patronusCast: 'EXPECTO PATRONUM! Əsandan gümüş maral fışqırır!',
    incendioLight: 'Incendio! Alov dilimləri canlanır.',
    incendioBurning: 'O alov onsuz da şən-şən yanır.',
    incendioStone: 'Sehr çılpaq daşı qarsır. Sönmüş şamlara və məşəllərə nişan al.',
    incendioDark: 'Bir alov dilimi qaranlığa qıvrılıb sönür.',
    aguamentiDouse: 'Aguamenti! Alov buxar püskürərək fısıltı ilə sönür.',
    aguamentiNothing: 'Orada yanan heç nə yoxdur.',
    aguamentiSplash: 'Bir şırnaq su daşların üstünə çilənir.',
    leviosaJoke: 'Wingardium Levi-O-sa! (“Levi-O-sa deyilir, Levio-SA yox.”)',
    leviosaFloat: 'Wingardium Leviosa! {name} havada süzür.',
    leviosaNothing: 'Orada qaldırıla biləcək yüngül bir şey yoxdur. (Yeşiyi, kitabı, qədəhi və ya iksir şüşələrini yoxla.)',
    leviosaDown: 'Onu yavaşca yerə endirirsən.',
    doorBudge: '{door} tərpənmir. Bəlkə bir sehr kömək edər… [3]',
    promptLocked: '{door} — <i>bağlıdır</i>. <b>Alohomora</b> [3] sına',
    promptOpen: '<span class="key">E</span> {door} — aç',
    promptClose: '<span class="key">E</span> {door} — bağla',

    door_gate: 'Qala Darvazası',
    door_hall: 'Böyük Zalın Qapıları',
    door_classroom: 'Sehrlər Sinfi',
    door_potions: 'İksir Anbarı',
    item_crate: 'yeşik', item_book: 'kitab', item_goblet: 'qədəh', item_flask: 'kolba', item_bottle: 'şüşə',

    hintMap: 'Cibində nəsə xışıldayır — köhnə perqament; solğun mürəkkəblə and içir ki, niyyəti yaxşı deyil. [M]',
    hintCat: 'Qarşıda, qaranlıqda alçaqdan gözlər parıldayır. Pişiklər işıqla ovlayır — yanan əsa onlar üçün fənərdir. Bəlkə Nox?',
    hintLeviosa: 'Qala hər yerdə nəsə atıb gedir — bir yelləmə, bir çırtma ilə havaya qalxar. [6]',
    hintPoints: '(Giriş Zalındakı qum saatları hesabı aparır. Yaxşı işlə daşlar qalxır — fitnə ilə boşalır.)',
    hintRoom: 'Məşəllərin arasında bir divar sanki nəyisə gözləyir… Elə bil yanından yenidən keçib-keçməyəcəyini fikirləşir.',
    roomReveal: 'Daş dalğalanır — və heç vaxt orada olmayan bir qapı nəzakətlə peyda olur.',
    cloakFound: 'Tozun altında: sanki ay işığından toxunmuş bir plaş. Yox olmaq üçün C bas. (Amma unutma — Dementorlar gözlə ovlamır.)',
    cloakOnCap: 'Gözdən itirsən.',
    cloakOffCap: 'Plaşı çiynindən atırsan.',
    door_room: 'Ehtiyac Otağı',
  },
};

const LANG_KEY = 'hogwarts-lang';
let lang = null;

export function storedLang() {
  try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; }
}

export function setLang(l) {
  lang = STRINGS[l] ? l : 'en';
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* fine */ }
}

export function getLang() { return lang || 'en'; }

export function t(key, vars) {
  let s = (STRINGS[getLang()] && STRINGS[getLang()][key]) || STRINGS.en[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

// applies static texts to the DOM (ids match dictionary keys)
export function localizeDom() {
  for (const id of ['subtitle', 'controls', 'enterhint', 'fineprint', 'objhead', 'sortTitle', 'sortQuote', 'hatpick']) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = t(id);
  }
  document.querySelectorAll('#sorting .house[data-house] span').forEach((sp) => {
    const i = sp.parentElement.dataset.house;
    if (i !== 'hat') sp.textContent = t('trait' + i);
  });
}
