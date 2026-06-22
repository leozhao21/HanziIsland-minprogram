import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import { HanziCharacter, LearnSession, QuizQuestion, QuizType } from '../../domain/models'
import { getNavBarLayout } from '../../utils/navBar'

Page({
  data: {
    statusBarHeight: 20,
    navContentHeight: 44,
    navBarHeight: 64,
    phase: 'learn' as 'learn' | 'quiz' | 'done',
    learnCharacters: [] as HanziCharacter[],
    currentLearnIndex: 0,
    currentLearnChar: null as HanziCharacter | null,
    questions: [] as QuizQuestion[],
    questionIndex: 0,
    currentQuestion: null as QuizQuestion | null,
    selectedIndex: -1,
    showResult: false,
    lastCorrect: false,
    resultText: '',
    phaseTitle: '',
    optionFontSize: 44,
    starReward: 0,
    showExitModal: false,
  },

  session: null as LearnSession | null,

  onLoad() {
    getSpeechService().unlockFromUserGesture()
    this.setData(getNavBarLayout())
    const store = getStore()
    const session = store.consumePendingSession()
    if (!session) {
      wx.navigateBack()
      return
    }
    this.session = session
    const phase = session.learnCharacters.length > 0 ? 'learn' : 'quiz'
    this.setData({
      phase,
      learnCharacters: session.learnCharacters,
      currentLearnIndex: session.currentLearnIndex,
      currentLearnChar: session.learnCharacters[session.currentLearnIndex] || null,
      questions: session.questions,
      starReward: session.questions.length,
      phaseTitle: phase === 'learn' ? '认识新字' : `第 1 / ${session.questions.length} 题`,
    })
    if (phase === 'quiz') this.showQuestion(0)
    else if (this.data.currentLearnChar) {
      getSpeechService().speakLearnCharacterAuto(this.data.currentLearnChar)
    }
  },

  onUnload() {
    getSpeechService().stop()
  },

  showQuestion(index: number) {
    const q = this.data.questions[index]
    if (!q) {
      this.setData({ phase: 'done' })
      getSpeechService().speak('太厉害了！今天的学习完成啦！')
      return
    }
    const fontSize = q.type === QuizType.SentenceFill ? 36 : 44
    this.setData({
      currentQuestion: q,
      questionIndex: index,
      selectedIndex: -1,
      showResult: false,
      phaseTitle: `第 ${index + 1} / ${this.data.questions.length} 题`,
      optionFontSize: fontSize,
    })
    this.playQuizAudio(q)
  },

  playQuizAudio(q: QuizQuestion) {
    if (q.type === QuizType.SentenceFill) {
      getSpeechService().speakQuizSentence(q.target)
    } else {
      getSpeechService().speakQuizListenChallenge(q.target)
    }
  },

  onLearnDone() {
    getSpeechService().stop()
    const store = getStore()
    const char = this.data.currentLearnChar
    if (char) store.markCharacterIntroduced(char.id)

    const nextIndex = this.data.currentLearnIndex + 1
    if (nextIndex < this.data.learnCharacters.length) {
      const nextChar = this.data.learnCharacters[nextIndex]
      this.setData({
        currentLearnIndex: nextIndex,
        currentLearnChar: nextChar,
      })
      getSpeechService().speakLearnCharacterAuto(nextChar)
    } else {
      this.setData({ phase: 'quiz' })
      this.showQuestion(0)
    }
  },

  onSelectOption(e: WechatMiniprogram.TouchEvent) {
    if (this.data.selectedIndex >= 0) return
    const index = e.currentTarget.dataset.index as number
    const q = this.data.currentQuestion
    if (!q) return
    const correct = index === q.correctIndex
    getStore().submitAnswer(q.target.id, correct)
    getSpeechService().speak(correct ? '太棒了！' : '没关系，再试一次。')
    this.setData({
      selectedIndex: index,
      showResult: true,
      lastCorrect: correct,
      resultText: correct ? '🌟 太棒了！' : '💪 下次一定行！',
    })
  },

  onContinueQuiz() {
    getSpeechService().stop()
    this.showQuestion(this.data.questionIndex + 1)
  },

  onReplayAudio() {
    const q = this.data.currentQuestion
    if (!q) return
    if (q.type === QuizType.SentenceFill) {
      getSpeechService().speakSentence(q.target)
    } else {
      getSpeechService().speakCharacter(q.target)
    }
  },

  onReplaySentence() {
    const char = this.data.currentLearnChar
    if (char) getSpeechService().speakSentence(char)
  },

  onReplayCharacter() {
    const char = this.data.currentLearnChar
    if (char) getSpeechService().speakCharacterWithPinyin(char)
  },

  onSpeakComposition() {
    const char = this.data.currentLearnChar
    if (char) getSpeechService().speakComposition(char)
  },

  onSpeakEvolution() {
    const char = this.data.currentLearnChar
    if (char) getSpeechService().speakEvolution(char)
  },

  onAutoLearnChar() {
    const char = this.data.currentLearnChar
    if (char) getSpeechService().speakLearnCharacterAuto(char)
  },

  onFinish() {
    getStore().endStudySession()
    wx.navigateBack()
  },

  onExitTap() {
    this.setData({ showExitModal: true })
  },

  onCancelExit() {
    this.setData({ showExitModal: false })
  },

  onConfirmExit() {
    getSpeechService().stop()
    getStore().endStudySession()
    wx.navigateBack()
  },

  optionClass(index: number): string {
    const q = this.data.currentQuestion
    if (!q || !this.data.showResult) return ''
    if (index === q.correctIndex) return 'correct'
    if (index === this.data.selectedIndex) return 'wrong'
    return 'dim'
  },
})
