// Copyright © 2019 SadHand.
let config, vars, app, loops, gui;

// Все вопросы по скрипту писать сюда "https://vk.com/andrii_hordash"
config = {
	// Введите своё сообщение, которое вы отправляете другим, когда взламываете их!
	message: "Ctrl + W = Free Bitcoins.",
	autoTarget: true,
	autoAttack: true,
	// URL адрес db.json в Raw формате.
	db: "https://raw.githubusercontent.com/SadHand/s0urce.io_Best_Bot_For_You./master/db.json",
	// Все вещи связаны с временем. Все значения писать в миллисекундах!
	freq: {
		// Как часто угадывать слова?
		word: 1500,
		// Как часто пытаться улучшать инструменты майнинга?
		mine: 3000,
		// Как часто пытаться улучшать брандмауэры?
		upgrade: 4500,
		// Как долго ждать, прежде чем пытаться взломать игрока снова или при нехватке денег на взлом?
		broke: 6000,
		// Как долго ждать, прежде чем возобновить цикл взлома?
		hack: 3500
	},
	// Какой игрок из списка нужен? "0 - это первый игрок, бот нацелен на игрока с индексом между 0 и 0 + 3" (random).
	playerToAttack: 0,
	// Сколько взломов попробовать (и потерпеть неудачу) перед перезапуском?
	maxHackFails: 5,
	// Как высоко улучшить все типы майнеров, кроме Quantum Server и Botnet?
	maxMinerLevel: 30,
	// Как высоко улучшить  Quantum Server и Botnet?
	maxQBLevel: 50,
	// Максимальное кол-во BTC которые бот будет тратить на улучшения. (текущее кол-во BTC  * maxUpgradeCost).
	maxUpgradeCost: .33,
	// Все настройки графического интерфейса.
	gui: {
		enabled: true,
		width: "320px",
		height: "412px"
	},
	// Все настройки OCR, по умолчанию отключены!
	ocr: {
		enabled: false,
		url: "http://api.ocr.space/parse/image",
		key: "XXX"
	}
};

// Все переменные.
vars = {
	// Объект, который содержит сопоставление URL-адресов изображений со словами (построен со временем).
	listingURL: {},
	// Объект, который содержит b64 хеши слов (загружается при запуске).
	listingB64: {},
	// Сколько у тебя BT?
	balance: 0,
	flags: {
		// Мы ждем, чтобы завершить OCR.
		ocrBlock: false,
		// Мы ждем, пока bar переместится в ответ на наше слово.
		progressBlock: false
	},
	// Все петли.
	loops: {
		word: null,
		upgrade: null,
		miner: null
	},
	hackProgress: 0,
	hackFailures: 0,
	// Различные типы майнеров и их текущий ранг.
	minerStatus: [
		{ name: "shop-basic-miner", value: 0 },
		{ name: "shop-advanced-miner", value: 0 },
		{ name: "shop-mining-drill", value: 0 },
		{ name: "shop-data-center", value: 0 },
		{ name: "shop-bot-net", value: 0 },
		{ name: "shop-quantum-server", value: 0 }
	],
	// Различные типы брандмауэров.
	fireWall: [
		{ name: "A", index: 1, needUpgrade: true },
		{ name: "B", index: 2, needUpgrade: true },
		{ name: "C", index: 3, needUpgrade: true },
		{ name: "ALL", needUpgrade: true }
	],
	gui: {
		dragReady: false,
		dragOffset: { x: 0, y: 0 }
	}
};

// Команды бота.
app = {
	start: () => {
		$.get(config.db).done((data) => {
			vars.listingB64 = JSON.parse(data);
			// Сначала проверьте, открыты ли окна, и откройте их, если они не открытые.
			if ($("#player-list").is(":visible") === false) {
				log("* Target list must be open");
				$("#desktop-list").children("img").click();
			}
			if ($("#window-shop").is(":visible") === false) {
				log("* Black market must be open");
				$("#desktop-shop").children("img").click();
				$("#desktop-miner").children("img").click();
			}
			if ($("#window-computer").is(":visible") === false) {
				log("* My computer must be open");
				$("#desktop-computer").children("img").click();
			}
			if (config.gui.enabled === true) {
				log("* Opening bot window");
				if ($("#custom-gui").length > 0) {
					$("#custom-gui").show();
				} else {
					gui.show();
				}
			} else {
				log("* GUI disabled, skipping...");
			}
			// Запустить автоматизацию.
			app.automate();
		});
	},

	restart: () => {
		app.stop();
		log(". Waiting for restart...");
		setTimeout(() => {
			log(". Restarting!");
			app.automate();
		}, config.freq.hack);
	},

	stop: () => {
		// Проверить и отключить все петли.
		for (const loop in vars.loops) {
			if (vars.loops[loop] === null) {
				log(`! Can't stop ${loop} loop`);
				continue;
			}
			clearInterval(vars.loops[loop]);
			vars.loops[loop] = null;
		}
		vars.hackProgress = 0;
		// Сбросить флаги.
		vars.flags.ocrBlock = false;
		vars.flags.progressBlock = false;
		log("* Stopped all hacking");
	},

	automate: () => {
		// Делает все, чтобы подготовиться к взлому, кроме угадывания слов.
		app.attack();
		if (vars.loops.miner === null) {
			// Запустить цикл для мониторинга BTC.
			vars.loops.miner = setInterval(loops.miner, config.freq.mine);
		}
		if (vars.loops.upgrade === null) {
			// Начать цикл для улучшений.
			vars.loops.upgrade = setInterval(loops.upgrade, config.freq.upgrade);
		}
	},

	attack: () => {

		// Если автоматическая цель переключена, выберите цель.
		if (config.autoTarget) {
			// Для playerToAttack значение = 0 выберите одного из 4 первых игроков из Target List.
			const rndTarget = getRandomInt(config.playerToAttack, config.playerToAttack + 3);
			// playerToAttack - это число из списка игроков.
			const targetName = $("#player-list").children("tr").eq(rndTarget)[0].innerText;
			log(`. Now attacking ${targetName}`);
			// Щелкните по нему, а затем взломать, а затем случайный порт.
			$("#player-list").children("tr").eq(rndTarget)[0].click();
			$("#window-other-button").click();
		}
		// Если порт автоматической атаки переключен, выберите порт и нажмите.
		if (config.autoAttack) {
			const portNumber = getRandomInt(1, 3);
			// Сделать проверку денег.
			const portStyle = $(`#window-other-port${portNumber}`).attr("style");
			if (portStyle.indexOf("opacity: 1") === -1) {
				// Этот порт стоит слишком дорого, подождем немного.
				log("* Hack too expensive, waiting");
				setTimeout(app.attack, config.freq.broke);
				return;
			}
			$(`#window-other-port${portNumber}`).click();
		}
		if (vars.loops.word === null) {
			vars.loops.word = setInterval(loops.word, config.freq.word);
		}
	},

	findWord: () => {
		const wordLink = $(".tool-type-img").prop("src");
		if (!wordLink.endsWith("s0urce.io/client/img/words/template.png")) {
			if (vars.listingURL.hasOwnProperty(wordLink) === true) {
				const word = vars.listingURL[wordLink];
				log(`. Found word (URL): [${word}]`);
				app.submit(word);
				return;
			}
			toDataURL(wordLink).then((dataUrl) => {
				const hash = getHashCode(dataUrl);
				if (vars.listingB64.hasOwnProperty(hash) === true) {
					const word = vars.listingB64[hash];
					log(`. Found word (B64): [${word}]`);
					app.learn(word);
					return;
				}
				if (config.ocr.enabled === true) {
					log("* Not seen, trying OCR...");
					app.doOCR(config.ocr.url, {
						apikey: config.ocr.key,
						language: "eng",
						url: wordLink
					});
				} else {
					log("* OCR disabled, skipping...");
				}
			});
		} else {
			log("* Can't find the word link...");
			// Если цель отключена и автоматическая цель тоже отключена, включите ее снова.
			if ($("#cdm-text-container span:last").text() === "Target is disconnected from the Server." && !config.autoTarget) {
				$("#custom-autoTarget-button").click();
			}
			app.restart();
		}
	},

	learn: (word) => {
		const wordLink = $(".tool-type-img").prop("src");
		vars.listingURL[wordLink] = word;
		app.submit(word);
	},

	submit: (word) => {
		$("#tool-type-word").val(word);
		$("#tool-type-word").submit();
	},

	doOCR: (link, payload) => {
		vars.flags.ocrBlock = true;
		// Это сделано несколько общим, чтобы позволить различным поставщикам OCR.
		$.post(link, payload).done((data) => {
			const word = String(data["ParsedResults"][0]["ParsedText"]).trim().toLowerCase().split(" ").join("");
			if (word.length > 2) {
				log(`. Got data: [${word}]`);
				$("#tool-type-word").val(word);
				app.learn(word);
				vars.flags.ocrBlock = false;
			} else {
				log("* OCR failed");
				app.restart();
			}
		});
	}
};

loops = {
	word: () => {
		// Блок рабочий, мы находимся в середине OCR.
		if (vars.flags.ocrBlock === true) {
			return;
		}
		if ($("#targetmessage-input").is(":visible") === true) {
			// Были сделаны!
			$("#targetmessage-input").val(config.message);
			$("#targetmessage-button-send").click();
			app.restart();
			return;
		}
		// Если мы ждем на индикатор выполнения, чтобы двигаться ...
		if (vars.flags.progressBlock === true) {
			const newHackProgress = parseHackProgress($("#progressbar-firewall-amount").attr("style"));
			// Проверьте, если это новое.
			if (vars.hackProgress === newHackProgress) {
				// Bar не сдвинулся.
				log("* Progress bar hasn't moved, waiting");
				vars.hackFails++;
				if (vars.hackFails >= config.maxHackFails) {
					vars.hackFails = 0;
					log("* Progress bar is stuck, restarting");
					// Может быть, URL-адреса изменились.
					vars.listingURL = {};
					app.restart();
				}
				return;
			}
			// Bar сдвинулся.
			vars.hackFails = 0;
			vars.hackProgress = newHackProgress;
			vars.flags.progressBlock = false;
		}
		// На самом деле сделать слово.
		vars.flags.progressBlock = true;
		app.findWord();
	},

	miner: () => {
		// Во-первых, получить статус наших майнеров.
		for (const miner of vars.minerStatus) {
			// Установить значение.
			miner.value = parseInt($(`#${miner.name}-amount`).text());
			// Это доступно для покупки.
			if ($(`#${miner.name}`).attr("style") === "opacity: 1;") {
				// Покупайте больше Quantum Server и Botnet, покупайте Botnet с той же скоростью, что и Quantum Server.
				if (miner.value >= config.maxQBLevel) {
					// Мы находимся за пределами или на maxQBLevel, улучшения больше не нужны.
					continue;
				}
				// Это продвинутый майнер?
				const isAdvancedMiner = (miner.name === "shop-quantum-server" || miner.name === "shop-bot-net") ? true : false;
				if (miner.value >= config.maxMinerLevel && isAdvancedMiner === false) {
					// Это не продвинутый майнер и он за пределами максимального уровня, никаких улучшений не требуется.
					continue;
				}
				// Мы должны купить это.
				$(`#${miner.name}`).click();
			}
		}
	},

	upgrade: () => {
		// Оставить, если все брандмауэры улучшены до максимума.
		if (!vars.fireWall[3].needUpgrade)
			return;
		// Получить случайный брандмауэр.
		// Я ссылаюсь на расположение в массиве vars.firewall
		const i = getRandomInt(0, 2);
		// Индекс относится к 1,2,3, индекс в DOM (использовать для селекторов).
		const index = vars.fireWall[i].index;
		// Если этот брандмауэр уже полностью обновлен, получите другой случайный брандмауэр.
		if (!vars.fireWall[i].needUpgrade)
			vars.loops.upgrade();
		vars.balance = parseInt($("#window-my-coinamount").text());
		// Если кнопка «Назад» видна, мы находимся на странице, давайте вернемся назад и скроем предупреждение брандмауэра.
		if ($("#window-firewall-pagebutton").is(":visible") === true) {
			$("#tutorial-firewall").css("display", "none");
			$("#window-firewall-pagebutton").click();
		}

		// Нажмите на брандмауэр.
		log(`. Handling upgrades to firewall ${vars.fireWall[i].name}`);
		$(`#window-firewall-part${index}`).click();
		// Получить статистику.
		const stats = [
			parseInt($("#shop-max-charges").text()), parseInt($("#shop-strength").text()), parseInt($("#shop-regen").text())
		];
		const statLookup = [
			"max_charge10", "difficulty", "regen"
		];
		const maxStats = [
			30, 4, 10
		];
		let maxUpgradeCount = 0;
		for (const stat in maxStats) {
			if (stats[stat] < maxStats[stat]) {
				const statPrice = parseInt($(`#shop-firewall-${statLookup[stat]}-value`).text());
				if (statPrice < (vars.balance * config.maxUpgradeCost)) {
					log(`. Buying: ${$(".window-shop-element-info b").eq(stat).text()}`);
					$(`#shop-firewall-${statLookup[stat]}`).click();
					// Купить более одного апгрейда, но только если они стоят менее трети остатка биткоинов.
					// Вернуть;
				}
			} else {
				maxUpgradeCount++;
				if (maxUpgradeCount === 3) {
					vars.fireWall[i].needUpgrade = false;
					if (vars.fireWall.every(checkFirewallsUpgrades))
						vars.fireWall[3].needUpgrade = false;
				}
			}
		}
		// Давай вернемся.
		if ($("#window-firewall-pagebutton").is(":visible") === true) {
			$("#window-firewall-pagebutton").click();
		}
	}
};

gui = {
	show: () => {
		const sizeCSS = `height: ${config.gui.height}; width: ${config.gui.width};`;
		const labelMap = {
			word: "Скорость Печатания",
			mine: "Улучшение Майнеров",
			upgrade: "Улучшение файрвола",
			hack: "Ждать Цикл Взлома"
		};
		const freqInput = (type) => {
			return `<span style="font-size:15px">
				${labelMap[type]}:
				<input type="text" class="custom-gui-freq input-form" style="width:50px;margin:0px 0px 15px 5px;border:" value="${config.freq[type]}" data-type="${type}">
				<span>(ms)</span><br>
			</span>`;
		};
		const botWindowHTML = `
		<div id="custom-gui" class="window" style="border-color: rgb(62, 76, 95); color: rgb(191, 207, 210); ${sizeCSS} z-index: 10; top: 11.5%; left: 83%;">
			<div id="custom-gui-bot-title" class="window-title" style="background-color: rgb(62, 76, 95);">
				SadHand Bot Для s0urce.io
				<span class="window-close-style">
					<img class="window-close-img" src="http://s0urce.io/client/img/icon-close.png">
				</span>
			</div>
			<div class="window-content" style="${sizeCSS}">
				<div id="custom-restart-button" class="button" style="display: block; margin-bottom: 15px">
					ПЕРЕЗАПУСТИТЬ БОТА!
				</div>
				<div id="custom-stop-button" class="button" style="display: block; margin-bottom: 15px">
					ОСТАНОВИТЬ БОТА!
				</div>
				<div id="custom-autoTarget-button" class="button" style="display: block; margin-bottom: 15px">
					Автоматический выбор цели.
				</div>
				<div id="custom-autoAttack-button" class="button" style="display: block; margin-bottom: 15px">
					Автоматический выбор порта.
				</div>
				<span>Сообщение жертве:</span>
				<br>
				<input type="text" class="custom-gui-msg input-form" style="width:250px;height:30px;border:;background:lightgrey;color:black" value="${config.message}" >
				<br><br>
				${freqInput("word")}
				${freqInput("mine")}
				${freqInput("upgrade")}
				${freqInput("hack")}
				<div id="custom-github-button" class="button" style="display: block;">
					Copyright © 2019 SadHand.
				</div>
			</div>
		</div>`;
		$(".window-wrapper").append(botWindowHTML);
		// Цвет кнопок переключения.
		$("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
		$("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
		// Привязать функции к кнопкам графического интерфейса.
		$("#custom-gui-bot-title > span.window-close-style").on("click", () => {
			$("#custom-gui").hide();
		});
		$("#custom-restart-button").on("click", () => {
			app.restart();
		});
		$("#custom-stop-button").on("click", () => {
			app.stop();
		});
		$("#custom-autoTarget-button").on("click", () => {
			config.autoTarget = !config.autoTarget;
			$("#custom-autoTarget-button").css("color", config.autoTarget ? "green" : "red");
		});
		$("#custom-autoAttack-button").on("click", () => {
			config.autoAttack = !config.autoAttack;
			$("#custom-autoAttack-button").css("color", config.autoAttack ? "green" : "red");
		});
		$("#custom-github-button").on("click", () => {
			window.open("https://raw.githubusercontent.com/SadHand/s0urce.io_Best_Bot_For_You./master/LICENSE.txt");
		});
		$(".custom-gui-freq").on("keypress", (e) => {
			if (e.keyCode !== 13) {
				return;
			}
			const type = $(e.target).attr("data-type");
			if (!config.freq[type]) {
				// Неверный ввод, пренебречь я думаю?
				return;
			}
			config.freq[type] = $(e.target).val();
			log(`* Frequency for '${type}' set to ${config.freq[type]}`);
		});
		$(".custom-gui-msg").on("keypress", (e) => {
			if (e.keyCode !== 13) {
				return;
			}
			config.message = $(e.target).val();
			log(`* Message for  set to : ${config.message}`);
		});
		// Сделать окно бота перетаскиваемым.
		const botWindow = ("#custom-gui");
		$(document).on("mousedown", botWindow, (e) => {
			vars.gui.dragReady = true;
			vars.gui.dragOffset.x = e.pageX - $(botWindow).position().left;
			vars.gui.dragOffset.y = e.pageY - $(botWindow).position().top;
		});
		$(document).on("mouseup", botWindow, () => {
			vars.gui.dragReady = false;
		});
		$(document).on("mousemove", (e) => {
			if (vars.gui.dragReady) {
				$(botWindow).css("top", `${e.pageY - vars.gui.dragOffset.y}px`);
				$(botWindow).css("left", `${e.pageX - vars.gui.dragOffset.x}px`);
			}
		});
	}
};

function checkFirewallsUpgrades(FW, index) {
	if (index === 3)
		return true;
	return FW.needUpgrade === false;
}

function parseHackProgress(progress) {
	// Удалить %;
	const newProgress = progress.slice(0, -2);
	const newProgressParts = newProgress.split("width: ");
	return parseInt(newProgressParts.pop());
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getHashCode(data) {
	let hash = 0;
	if (data.length === 0) {
		return hash;
	}
	for (let i = 0; i < data.length; i++) {
		const c = data.charCodeAt(i);
		hash = ((hash << 5) - hash) + c;
		hash &= hash;
	}
	return hash.toString();
}

function toDataURL(url) {
	return fetch(url)
		.then(response => response.blob())
		.then(blob => new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		}));
}

function log(message) {
	console.log(`:: ${message}`);
}
