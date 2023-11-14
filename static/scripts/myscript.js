// グローバル変数
let sunrise_time, sunset_time;              // 日の出日の入り時刻
let morning_offset, evening_offset;         // 強制点灯のオフセット時間（分）
let morning_minutes, evening_minutes;       // 強制点灯時間（分）
let morning_start, evening_start            // 強制点灯開始時刻
let morning_end, evening_end                // 強制点灯終了時刻

let sensing_interval, sensing_count;        // 何分おきに何回光センサーの状態を取得するか
let outputRelays = [0,0,0,0,0];             // 全4個のアウトプットについて出力するかしないか　0番から始まるので5個用意する

// バッテリー設定　この数値はサンプルで、実際は設定ファイルから読み取る
let Ah = 100;                       // アンペアアワー
let power = 12;                     // 消費電力
let LEDcnt = 150;                   // 育成LEDの数
let voltage = 24;                   // バッテリー電圧
let BTcnt = 8;                      // バッテリーの数
let charge = 1500;                  // ソーラー＋風力の発電能力

let batt_yellow = 20;               // バッテリーグラフ 黄色になるパーセント
let batt_green = 80;                // バッテリーグラフ　緑色になるパーセント

let bp;                             // バッテリーパーセント
let maxwh, pwh, pv;                 // pが付くのは現在の値
let totalwh, needwh, leastwh;

let isReady = true;                 // 運転準備　プログラム内に運転準備を落とす処理はない
let isRun = false;                  // 起動中
let isAuto = true;                  // 自動か各個か
let isNightSense = false;           // 夜間でも光センサー取得するか
let isHumiTry = false;              // 温湿度計がトライか本番か
let isLightTry = false;             // 光センサーがトライか本番か
let isLightCnt = false;             // 光センサーを取得するだけか積算するか
let isLEDTry = false;               // 育成LEDがトライか本番か
let isLED = false;                  // 育成LEDを光らせるか
let lastIsLED = isLED;              // 一つ前の育成LED点灯状況
let isForce = false;                // LEDを強制的にオンオフさせるか光センサーで制御するか
let mode = true                     // モード（自動／強制オン／強制オフ／手動操作中）
let lastmode = false                // 1秒前のモード　モードが変わったらログを残す

let senging_time = "00:00";         // 次に光センサーの状態を取得する時刻
const sensing_threshold = 0.5;      // ★ LEDを付けるか消すかのしきい値（5個×回数 に対する割合）
let lightMinutesSum = 0;            // 1日の育成LED点灯時間累計（単位：分）
let lightOnTime;                    // 育成LED点灯時刻　引き算をするのでdayjs形式

const OPELOG = "動作ログ.txt"
const DAYLOG = "日当たりログ.txt"

let tab = "main";
let lights = "○−○−○";
const pins = ["26", "19", "13", "6", "5"];
let temp, humi                      // 温度と湿度

let now, today, time
let logMsg="";

$(async function() {
    // 読み込み完了後に一度だけ実行する関数
    await do1st();
    setInterval(showTime, 1000);

    // 起動ボタンを押す
    $("#btnRun").on('click', function(){
        if (isAuto) {                           // 自動モードのみ起動可能　括弧（手動）では動かない
            isRun = true;
            showRunLamp(isRun);
            getTimeMode();
            addMsg(time + "　起動しました");
        };
    });

    // 停止ボタンを押す
    $("#btnStop").on('click', function(){
        if (isRun) {                            // 起動中のみ停止可能
            isRun = false;
            showRunLamp(isRun);
            lastmode = false;                   // 起動ボタン押したときに時間モードを調べるためlastmodeの値をfalseにする
            addMsg(time + "　停止しました");
        };
    });

    // 自動手動　切り替え
    $("#swAuto").on('click', function(){
        isAuto = !isAuto;
        showState();
        if (isAuto) {
            showLights(lights);
            enpowerLED(isLED);
            showLedLamp(isLED);
            $("#mode").text(mode);
            addMsg(time + "　自動に切り替えました");
            showRunLamp(isRun);
           
        } else {
            isRun = false;              // 手動にしたら運転が落ちる
            isLED = false;
            showRunLamp(isRun);
            enpowerLED(isLED);
            showLedLamp(isLED);
            addMsg(time + "　手動に切り替えました");
            $("#mode").text("手動操作中");
            $("#main_msg").removeClass("main_msg_ok");
            $("#main_msg").addClass("main_msg_ng");
            $("#main_msg").text("手動操作モードです　制御盤で自動に切り替え、起動ボタンを押してください");

        }
    })

    // ランプ全点灯ボタンを押す（手動操作時のみ）
    $("#btnAllLight").mousedown(function(){
        if (! isAuto) {
            $("#imgLight").attr("src", "static/images/btnRedOn.png");
            showLights("○○○○○○○○");
            showLedLamp(true);
        }
    })

    // ランプ全点灯ボタンを離す（手動操作時のみ）
    $("#btnAllLight").mouseup(function(){
        if (! isAuto) {
            $("#imgLight").attr("src", "static/images/btnRedOff.png");
            showLights("−−−−−−−−");
            showLedLamp(false);
        }
    })

    // 育成LED強制点灯ボタンを押す（手動操作時のみ）
    $("#btnLedOn").mousedown(function(){
        if (! isAuto) {
            $("#imgLedOn").attr("src", "static/images/btnRedOn.png");
            enpowerLED(true);
        }
    })

    // 育成LED強制点灯ボタンを離す（手動操作時のみ）
    $("#btnLedOn").mouseup(function(){
        if (! isAuto) {
            $("#imgLedOn").attr("src", "static/images/btnRedOff.png");
            enpowerLED(false);
            showLedLamp(false);
        }
    })

    // 設定画面を出す
    $("#btnConfig").on("click", function(){
        getConfig();
        $(".config_bg").css("visibility", "visible");
        $(".config_window").css("visibility", "visible");
    });


    // 設定変更ボタンを押す
    $("#setConfig").on("click", function(){
        setConfig();
        $(".config_bg").css("visibility", "hidden");
        $(".config_window").css("visibility", "hidden");
        $(".admin_window").css("visibility", "hidden");
        clearLightMsg();
    });

    // 設定変更ボタンを押す2
    $("#setConfig2").on("click", function(){
        setConfig();
        $(".config_bg").css("visibility", "hidden");
        $(".config_window").css("visibility", "hidden");
        $(".admin_window").css("visibility", "hidden");
        clearLightMsg();
    });

    // 設定画面を閉じる
    $(".config_bg").on("click", function(){
        $(".config_bg").css("visibility", "hidden");
        $(".config_window").css("visibility", "hidden");
        $(".admin_window").css("visibility", "hidden");
        $(".clock_window").css("visibility", "hidden");
    });


    // 工場設定画面を出す
    $("#btnAdmin").on("click", function(){
        getConfig();
        $(".config_bg").css("visibility", "visible");
        $(".admin_window").css("visibility", "visible");
    });

    // 時計画面を出す
    $("#btnClock").on("click", function(){
        $(".config_bg").css("visibility", "visible");
        $(".clock_window").css("visibility", "visible");
        const now = dayjs();
        $("#year").val(now.year());
        $("#month").val(now.month()+1);         // 月は0～11で返されるので+1する
        $("#day").val(now.date());
        $("#hour").val(now.hour());
        $("#minute").val(now.minute());
    });

    // 時計設定ボタンを押す
    $("#setClock").on("click", function(){
        const year = $("#year").val();
        const month = $("#month").val();        // dayjsを使っているわけではないので-1しない
        const day = $("#day").val();
        const hour = $("#hour").val();
        const minute = $("#minute").val();
        const set_time = dayjs(`${year}-${month}-${day} ${hour}:${minute}:00`).format("MMDDHHmmYYYY");
        setClock(set_time);
        $(".config_bg").css("visibility", "hidden");
        $(".config_window").css("visibility", "hidden");
        $(".admin_window").css("visibility", "hidden");
        $(".clock_window").css("visibility", "hidden");
    });


    // トライボタン切り替え
    $(".btnTry").on('click', function(){
        const btnid = $(this).attr("id");
        var bool = false;
        switch (btnid) {
            case "HumiTry":
                isHumiTry = ! isHumiTry;
                bool = isHumiTry;
                break;
            case "LightTry":
                isLightTry = ! isLightTry;
                bool = isLightTry;
                break;
            case "LEDTry":
                isLEDTry = ! isLEDTry;
                bool = isLEDTry;
                break;
            case "NightSense":
                isNightSense = ! isNightSense;
                bool = isNightSense;
                if (isNightSense) {                     // 夜でもセンシングする設定ならば1分後に測定する
                    senging_time = senging_time = dayjs().add(1, "minutes").format("HH:mm:30");
                } else {                                // 夜はセンシングしない設定ならば
                    lastmode = ""                       // ラストモードをリセットすることで
                    getTimeMode();                      // 強制的に時間モードを変更する（元に戻す）
                }
                break;
            }
        showTryBtn("#"+btnid, bool);
    })
    
    // 出力選択ボタンを押す
    $(".btnOutput").on('click', function(){
        const id = $(this).attr("id");              // ボタンID
        const num = id.slice(-1);                   // IDの末尾1文字
        let bool = outputRelays[num];               // そのボタンの状態
        bool = ! bool;                              // 設定反転する
        outputRelays[num] = bool;                   // 反転した結果を変数に代入する
        showOutputLamp("#" + id, bool);             // 反転した結果でランプを点灯消灯させる
    });

});


//////////////////////////////////////////////////////////////////////
// 最初に1回だけ実行する関数
//////////////////////////////////////////////////////////////////////
async function do1st() {
    // インプットボックスにjQuery keypadを設定する
    const kbOpt = {showAnim: "slideDown", showOptions: null, duration: "fast", showOn:"button"};    // 数値キーパッドのオプション
    const ids = ["lat", "lon", "elev", "morning_offset", "evening_offset", "morning_minutes", "evening_minutes",
                 "sensing_interval", "sensing_count", "year", "month", "day", "hour", "minute", "batt_yellow", "batt_green"];    // キーパッドを設定するid
    $.each(ids, function(i, id){
        $("#" + id).keypad(kbOpt);
    });
    getNow();
    clearMsg();
    addMsg(time+"　開始")
    showReadyLamp(isReady);     // Ready（運転準備）ランプ
    showRunLamp(isRun);         // 起動ランプ
    await getEphem();           // 暦を取得する
    await getConfig();          // 設定を取得する
    calcTime();                 // 時間を計算する
    showTryBtn("#HumiTry", isHumiTry);
    showTryBtn("#LightTry", isLightTry);
    showTryBtn("#LEDTry", isLEDTry);
    showTryBtn("#NightSense", isNightSense);
    clearLightMsg();
    showDailyLog();
    //await getBatt(true);
    await getHumi(true);
    await getContec(true, false);
    showLights(lights);
}

//////////////////////////////////////////////////////////////////////
// 表示しているタブを取得する
function getTab() {
    const elm = $('input:radio[name="tab_item"]:checked')
    return elm.val();
}

// 今日の日付を取得する　グローバル変数に格納するだけ
function getNow() {
    now = dayjs();
    today = now.format("YYYY/MM/DD");
    time = now.format("HH:mm:ss");
};


//////////////////////////////////////////////////////////////////////
// 時計　兼　アラーム
//////////////////////////////////////////////////////////////////////
async function showTime() {
    getNow();
    $("#time").html(today + " " + time);

    const h = now.hour();
    const m = now.minute();
    const s = now.second();

    if (isAuto) {
        // 60分ごとに温湿度を更新する　ただし運転中のみ
        if (m==10 && s==20 && isRun) {
            getHumi(isHumiTry);
        }

        // 1分ごとにコンテック（光センサー＋バッテリー）を更新する
        if (time >= senging_time) {                             // センサーを取得する時刻になったら
            const cond = isRun && (mode=="昼" || isNightSense);  // 条件　運転中 かつ （昼間 もしくは夜でもセンシングする設定）
            if (cond) {                                         // 条件を満たしたら
                isLightCnt = true;                              // 光センサー積算する
            } else {                                            // さもなくば
                isLightCnt = false;                             // 積算しない
            }
            senging_time = dayjs().add(sensing_interval, "minutes").format("HH:mm:30");     // 次に光センサーを取得する時刻
        } else {                                                // センサーを取得する時刻になっていなかったら
                isLightCnt = false;                             // 積算しない
        }
        getContec(isLightTry, isLightCnt);                      // 以上の条件でコンテックを取得する
        
        //0時0分になったらあらためて1日分の記録を残し、暦を取得する
        if (time=="00:00:00") {
            addMsg(time+"　日付が変わった")
            addMsg("　日照時間:" + lightMinutesSum + "分")
            getEphem();
            await writeLog("日付変更", OPELOG)
            await writeLog(dayjs().add(-1, "d").format("YYYY/MM/DD") + "　日照時間:" + lightMinutesSum + "分", DAYLOG);
            lightMinutesSum = 0;
        }

        // 日の出などの時間による制御
        getTimeMode();
    }
}


//////////////////////////////////////////////////////////////////////
// トライの状態を表示する関数
function showTryBtn(btnid, bool) {
    const elm = $(btnid);
    if (btnid == "#NightSense") {
        if (bool) {
            elm.css("background-color", "pink");
            elm.text("測定する");
        } else {
            elm.css("background-color", "yellow");
            elm.text("測定しない");
        };
    } else {
        if (bool) {
            elm.css("background-color", "pink");
            elm.text("トライ");
        } else {
            elm.css("background-color", "yellow");
            elm.text("本番");
        };
    };
};

//////////////////////////////////////////////////////////////////////
//    ログ
//////////////////////////////////////////////////////////////////////
// メッセージを表示する
function addMsg(txt) {
    logMsg = $("#logbox").html();
    logMsg += txt;
    let msg = "";
    const rows = logMsg.split("<br>")                           // メッセージ1行ずつのリスト
    const rowCnt = rows.length                                  // リストの行数
    const maxRowCnt = 18;                                       // 表示する最大行数
    for (i=Math.max(0, rowCnt-maxRowCnt); i<rowCnt; i++) {      // 全部で最大行になるように途中から
        msg += rows[i] + "<br>"                                 // 行メッセージを追加
    }
    $("#logbox").html(msg);                                     // それをあらためて表示する
}

// メッセージを全削除する
function clearMsg() {
    $("#logbox").html("");
}

// センサーログを表示する
function addLightLog(txt) {
    logMsg = $("#lightlog").html();
    logMsg += txt + "<br>";
    $("#lightlog").html(logMsg);
}

// 光センサーログを削除する
function clearLightMsg() {
    $("#lightlog").html("光センサー　○：曇り　−：晴れ<br>　" + sensing_interval + "分間隔で" + sensing_count + "回測定し、次の点灯消灯を判断します<br><br>");
}

// ログをテキストファイルに保存する
async function writeLog(text, filename) {
    await $.ajax("/writeLog", {
        type: "POST",
        data: {"text": text, "filename": filename}
    }).done(function(data) {
//        console.log("ログへの書き込み成功");
    }).fail(function() {
        console.log("ログへの書き込み失敗");
    });
};


// ログの最終行を更新する
async function refreshDailyLog(text) {
    await $.ajax("/refreshDailyLog", {
        type: "POST",
        data: {"text": text}
    }).done(function(data) {
//        console.log("ログ最終行の更新成功");
    }).fail(function() {
        console.log("ログ最終行の更新失敗");
    });
};

// デイリーログ
async function showDailyLog() {
    await $.ajax("/showDailyLog", {
        type: "POST",
        data: {},
    }).done(function(data) {
        const dict = JSON.parse(data);
        $("#dailylog").html(dict["text"]);
        $("#dailylog_main").html(dict["text"]);
    }).fail(function() {
        console.log("デイリーログ取得失敗");
    });
};

//////////////////////////////////////////////////////////////////////
//    温湿度
//////////////////////////////////////////////////////////////////////
async function getHumi(isTry) {
    await $.ajax("/getHumi", {
        type: "post",
        data: {"isTry": isTry},                 // テストか本番かのbool値をisTryとして送る
    }).done(function(data) {
        const dict = JSON.parse(data);
        if (dict["temp"] != "N/A") {            // センサー値取得できていたら
            temp = dict["temp"];
            humi = dict["humi"];
            $("#temp").text(temp + "℃");
            $("#humi").text(humi + "％");
            addMsg(time + "　温湿度更新");
        } else {                                // センサー値取得できなかったら
            console.log("温湿度　センサー失敗");
        }
    }).fail(function() {                        // ajaxのリターン失敗したら更新しない
        console.log("温湿度　通信失敗");
    });
}



//////////////////////////////////////////////////////////////////////
//    コンテック
//////////////////////////////////////////////////////////////////////
async function getContec(isTry, isLightCnt) {
    let msg = "";
    await $.ajax("/getContec", {
        type: "post",
        data: {"isTry": isTry,                                          // テストか本番かのbool値をisTryとして、
               "isLightCnt": isLightCnt},                               // 光センサーを取得するだけか積算するかをisLightCntとして送る
    }).done(function(data) {
        const dict = JSON.parse(data);
        try {                                                           // センサー値取得できていたら
            // 電圧リレーの状態
            const volt_status = dict["volt"];                           // コンテックの電圧
            if (volt_status == "青" ) {                                  // 「青」ならば
                $(".batt_blue").css("visibility","visible");            // グラフの青バーを表示
                $(".batt_green").css("visibility","visible");           // グラフの緑バーを表示
            } else if (volt_status == "緑") {                            // 「緑」ならば
                $(".batt_blue").css("visibility","hidden");             // グラフの青バーを非表示
                $(".batt_green").css("visibility","visible");           // グラフの緑バーを表示
            } else {                                                    // いずれでもなければ
                $(".batt_blue").css("visibility","hidden");             // グラフの青バーを非表示
                $(".batt_green").css("visibility","hidden");            // グラフの緑バーを非表示
            };                                                          // つまり、グラフの黄色バーは消えない（0の判定はない）

            // 光センサーの状態
            showLights(dict["log"]);                                    // 制御盤のランプを点灯させる

            if (isLightCnt) {                                           // 光センサー積算する設定ならば
                if (dict["light_cnt"]==0) {                             // 0回目で
                    clearLightMsg();                                    // メッセージをクリアする
                }
                const lightlog = dict["log"].slice(0,5);                // コンテックの光センサー＋バッテリーから光センサーを切り出す
                msg = time + "　#" + (dict["light_cnt"]+1) + "　" + lightlog;
                addLightLog(msg);

                const th = 5*sensing_count*sensing_threshold;
                if (dict["light_cnt"] == sensing_count-1) {             // 指定した回数だけセンサー値を測定したら
                    addLightLog("曇りのカウント" + dict["light_sum"] + "　　しきい値" + th);
                    if (dict["light_sum"] < th) {                               // 点灯消灯判断　しきい値未満ならば
                        isLED = false;                                          // 消灯にする
                        if (lastIsLED) {                                        // さっきまで点灯していたら
                            msg = "十分明るいので消灯します";
                            const lightMinutes = dayjs().diff(lightOnTime, "minutes");      // lightOnTimeから今までの時間（単位：分）
                            msg += "点灯時間 " + lightMinutes + "分";
                            lightMinutesSum += lightMinutes;
                            refreshDailyLog(lightMinutesSum);
                            showDailyLog();
                        } else {
                            msg = "消灯を継続します";
                        };
                    } else {                                                    // さもなくば　つまりしきい値以上ならば
                        if (volt_status == "青" || volt_status == "緑") {             // コンテックの電圧が青か緑ならば
                            isLED = true;                                           // 点灯にする
                            if (lastIsLED) {                                        // さっきまで点灯していたら
                                msg = "点灯を継続します";
                            } else {   
                                msg = "暗いので点灯します";
                                lightOnTime = dayjs();
                            };
                        } else {                                                    // 電圧が黄色ならば
                            msg = "バッテリーが不足気味なので点灯しません"
                        };
                    };
                    addMsg(time + "　" + msg);
                    addLightLog(msg);
                    lastIsLED = isLED;
                    enpowerLED(isLED);
                };
            };
        } catch(e) {                            // センサー値取得できなかったら
            console.log("コンテック　データ失敗");
            console.log(e);
        };
    }).fail(function() {                        // ajaxのリターン失敗したら
        console.log("コンテック　通信失敗");
    });
};

// 光センサーの状態を表示する関数
function showLights(txt) {
    const arr = txt.split("");
    for (let i=0; i<arr.length; i++) {
        let color="";
        if (arr[i]=="○") {
            color = "red";
        } else {
            color = "gray";
        }
        $("#lamp" + i).css("color",color);
    };
};


// 育成LEDを光らせる
async function enpowerLED(flag) {
    let img = "static/images/";
    let color = "";
    let isOn = 0;

    if (flag) {
        img += "led_on.png";
        color = "red";
        isOn = 1;
    } else {
        img += "led_off.png";
        color = "gray";
        isOn = 0;
    }

    $("#imgLed").attr("src", img);
    $("#lamp_led").css("color", color);
    
   await $.ajax("/enpowerLED", {
       type: "post",
       data: {"isOn": isOn},
    }).done(function() {
        // 特に何もしない
    }).fail(function() {  
        // 特に何もしない
    });
}


// フラグの状態を表示する関数
function showState() {
    var strAuto = "";
    var imgSw = "";
    if (isAuto) {
        strAuto = "自動";
        imgSw = "sw_l.png";
    } else {
        strAuto = "各個";
        imgSw = "sw_r.png";
    };
    $("#stateAuto").text(strAuto);
    $("#imgAuto").attr("src", "static/images/" + imgSw );
}


// 育成LEDの状態を表示する関数
function showLedLamp(flag) {
    var color="";
    if (flag) {
        color = "red";
    } else {
        color = "gray";
    }
    $("#lamp_led").css("color",color);
}


//////////////////////////////////////////////////////////////////////
//    暦
//////////////////////////////////////////////////////////////////////
async function getEphem() {
    $("#date").text(dayjs().format("M月D日"))               // 日付
    await $.ajax("/getEphem", {
        type: "POST",
    }).done(function(data) {
        const dict = JSON.parse(data);
        sunrise_time = dict["sunrise_time"];                // 日の出時刻　HH:MM形式
        sunset_time = dict["sunset_time"];                  // 日没時刻　HH:MM形式
        $("#sunrise").text(sunrise_time);                   // 日の出時刻
        $("#sunset").text(sunset_time);                     // 日没時刻
        $("#moon_phase").text(dict["moon_phase"]);          // 月相
        $("#moon_image").attr("src", dict["moon_image"]);   // 月の画像

        console.log("暦取得成功");
    }).fail(function() {
        console.log("暦取得失敗");
    });
};

function calcTime() {
    // 点灯時間を計算する　暦と設定の取得が先

    // 日の出日の入り時刻から育成LED点灯消灯の時刻を計算する
    // まずはdayjsとして計算する　そのためには日付も必要
    morning_start = dayjs(today+" "+sunrise_time).add(morning_offset, "m");
    morning_end = morning_start.add(morning_minutes, "m");
    evening_end = dayjs(today+" "+sunset_time).add(-evening_offset, "m");
    evening_start = evening_end.add(-evening_minutes, "m");
    // 次にそれを文字列にする
    morning_start = morning_start.format("HH:mm");
    morning_end = morning_end.format("HH:mm");
    evening_start = evening_start.format("HH:mm");
    evening_end = evening_end.format("HH:mm");
    // ブラウザに表示する
    $("#morning_start").text(morning_start);
    $("#evening_start").text(evening_start);
    $("#morning_end").text(morning_end);
    $("#evening_end").text(evening_end);
}



async function getTimeMode() {
    getNow();
    let msg = ""
    const now = time.slice(0, 5)            // HH:mm:ss を HH:mm にする
    // 現在がどの時刻モードかを調べる　これは毎秒おこなう必要がある
    switch (true) {                         // ここは優先順位として大きい値から判断していく
        case now >= evening_end:            // 日の入り以降は強制OFF
            mode = "夜";
            break;
        case now >= evening_start:          // 日の入り1.5H前以降は強制ON
            mode = "夕方";
            break;
        case now >= morning_end:            // 日の出1.5H後以降は自動制御
            mode = "昼";
            break;
        case now >= morning_start:          // 日の出以降は強制ON
            mode = "朝";
            break;
        default:                            // それ以前（0時以降）は強制OFF
            mode = "夜";
    };

    // 時刻モードが変更になったときのみ以下の処理をおこなう
    if ((mode != lastmode)) {
        lastmode = mode;
        switch (mode) {
            case "夜":
                //mode = "強制OFF";
                msg = "　夜です　";
                isForce = true;
                isLED = false;
                break;
            case "夕方":
                //mode = "強制ON";
                msg = "　夕方です　";
                isForce = true;
                isLED = true;
                break;
            case "昼":
                //mode = "自動制御";
                msg = "　昼です　";
                isForce = false;
                break;
            case "朝":
                //mode = "強制ON";
                msg = "　朝です　";
                isForce = true;
                isLED = true;
                break;
        };
        msg = time + msg + "モード変更　" + mode;
        addMsg(msg);
        if (isRun) {                    // 運転中ならば
            enpowerLED(isLED);          // 育成LEDを制御する
        }
        await writeLog(msg, OPELOG);
    }
    $("#mode").text(mode);
}


//////////////////////////////////////////////////////////////////////
//    バッテリ電圧
//////////////////////////////////////////////////////////////////////
/*
// バッテリーの電圧を取得する関数
async function getBatt(isTry) {
    await $.ajax("/getBatt", {
        type: "post",
        data: {"isTry": isTry},             // テストか本番かのbool値をisTryとして送る
    }).done(function(data) {
        const dict = JSON.parse(data);
        bp = dict["ana3"];
    }).fail(function() {
        console.log("バッテリー電圧取得失敗");
        bp = 0;
    });
    showBatt(bp);
    return bp;
}


// バッテリーの計算をする関数
function showBatt(bp) {
    maxwh = Math.trunc(Ah * voltage * BTcnt / 2);   // 満充電の容量
    // maxv = voltage;
    pwh = Math.trunc(maxwh * bp / 100);             // 現在のWh
    pv = Math.trunc(voltage * bp/100);              // 現在の電圧
    charge = Math.trunc(charge*.3);                 // ソーラー発電を最大の30%とする

    totalwh = Math.trunc(pwh+charge);               // 現在のバッテリWhと計算上の充電量の合計
    needwh = power * LEDcnt * 1.5;                  // 1.5H点灯させるのに必要なWh
    leastwh = maxwh * .05;                          // 満充電の5%になったら停止させる
//    capa = Ah * voltage * BTcnt / 2;

    $("#bp").text(bp);          // パーセント
    $("#pwh").text(pwh);
    $("#maxwh").text(maxwh);
    $("#voltage").text(voltage);
    $("#pv").text(pv);
    $("#maxv").text(voltage);
    $("#calc_needwh").html(power+"W*"+LEDcnt+"本*1.5h="+needwh+"Wh");
    $("#calc_totalwh").html(pwh+"Wh+"+charge+"Wh="+totalwh+"Wh");
    $("#totalwh").html(totalwh);
    $("#calc_leastwh").html(maxwh+"Wh*5%="+leastwh+"Wh");
    $("#batt-black").css("width", (100-bp)+"%");
}
*/

//////////////////////////////////////////////////////////////////////
//    設定
//////////////////////////////////////////////////////////////////////
// 設定ファイルを取得する関数
async function getConfig() {
    await $.ajax("/getConfig", {
        type: "POST",
    }).done(function(data) {
        const dict = JSON.parse(data);

        // 暦　変数にはせず、ブラウザ上に出力するのみ
        $("#place").val(dict["place"]);     // 場所
        $("#lat").val(dict["lat"]);         // 経度
        $("#lon").val(dict["lon"]);         // 緯度
        $("#elev").val(dict["elev"]);       // 標高

        // 朝と夕方の強制点灯の設定
        morning_offset = Number(dict["morning_offset"]);        // 日の出の何分後に始まる
        evening_offset = Number(dict["evening_offset"]);        // 日の入りの何分前に終わる
        morning_minutes = Number(dict["morning_minutes"]);      // 朝の強制点灯時間
        evening_minutes = Number(dict["evening_minutes"]);      // 夕方の強制点灯時間
        $("#morning_offset").val(morning_offset);
        $("#evening_offset").val(evening_offset);
        $("#morning_minutes").val(morning_minutes);
        $("#evening_minutes").val(evening_minutes);
        
        // 光センサー取得設定
        sensing_interval = Number(dict["sensing_interval"]);    // 光センサー取得間隔
        sensing_count = Number(dict["sensing_count"]);          // 光センサー取得回数
        $("#sensing_interval").val(sensing_interval);
        $("#sensing_count").val(sensing_count);

        // コンテックのボード出力設定
        for (i=1; i<=4; i++) {
            outputRelays[i] = str2Bool(dict["output" + i]);     // 文字列の0/1を真偽値にする
            showOutputLamp("#output" + i, outputRelays[i]);     // 状態を画面に表示する
        }

        // バッテリー設定
        batt_yellow = dict["batt_yellow"];
        batt_green = dict["batt_green"];
        $(".batt_yellow").css("width", batt_yellow+"%");
        $(".batt_green").css("width", (batt_green-batt_yellow)+"%");
        $(".batt_blue").css("width", (100-batt_green)+"%");
        $("#batt_yellow").val(batt_yellow);
        $("#batt_green").val(batt_green);
        /*
        Ah = Number(dict["Ah"]);
        power = Number(dict["power"]);
        LEDcnt = Number(dict["LEDcnt"]);
        voltage = Number(dict["voltage"]);
        BTcnt = Number(dict["BTcnt"]);
        charge = Number(dict["charge"]);
        $("#Ah").val(Ah);
        $("#power").val(power);
        $("#LEDcnt").val(LEDcnt);
        $("#voltage").val(voltage);
        $("#BTcnt").val(BTcnt);
        $("#charge").val(charge);
        */
        
        senging_time = dayjs().add(1, "minutes").format("HH:mm:30");     // 次に光センサーを取得する時刻
        console.log("設定ファイル取得成功");
    }).fail(function() {
        console.log("設定ファイル取得失敗");
    });
};

// 設定を変更する関数
async function setConfig() {
    // ブラウザ上に表示されている値をまとめて辞書に登録する
    let dict = {};
    const ids = [   "place", "lat", "lon", "elev",
                    "morning_offset", "evening_offset", "morning_minutes", "evening_minutes",
                    "sensing_interval", "sensing_count",
                    "batt_yellow", "batt_green"];
    $.each(ids, function(i, id){
        dict[id] = $("#" + id).val();
    });

    // アウトプットは別途登録する
    for (i=1; i<=4; i++) {
        dict["output" + i] = outputRelays[i];
    }

    // 設定ファイルに書き込む
    await $.ajax("/setConfig", {
        type: "POST",
        data: dict,
    }).done(function(data) {
        console.log("設定ファイル変更成功");
    }).fail(function() {
        console.log("設定ファイル変更失敗");
    });
    await getConfig()               // 変更した設定をあらためて取り込む
    calcTime();                     // 変更した設定に伴い再計算する
};


// PythonでOSの時刻を変更する関数
async function setClock(set_time) {
    await $.ajax("/setClock", {
        type: "POST",
        data: {"set_time": set_time},
    }).done(function(data) {
        console.log("時刻変更成功");
    }).fail(function(e) {
        console.log("時刻変更失敗");
        console.log(e);
    });
};


// 起動ランプ
function showRunLamp(bool) {
    if (bool) {
        $("#btnRun").attr("src", "static/images/btnOrangeOn.png");
        $("#main_msg").removeClass("main_msg_ng");
        $("#main_msg").addClass("main_msg_ok");
        $("#main_msg").text("起動中です");
    } else {
        $("#btnRun").attr("src", "static/images/btnOrangeOff.png");
        $("#main_msg").removeClass("main_msg_ok");
        $("#main_msg").addClass("main_msg_ng");
        $("#main_msg").text("停止中です　制御盤で起動ボタンを押してください");
    }
}

// 運転準備（Ready）ランプ
function showReadyLamp(bool) {
    if (bool) {
        console.log("ランプ点灯");            
        $("#lampReady").attr("src", "static/images/btnGreenOn.png");
    } else {
        console.log("ランプ消灯");            
        $("#lampReady").attr("src", "static/images/btnGreenOff.png");
    }
}

// アウトプットリレーランプ
function showOutputLamp(id, bool) {
    if (bool) {
        $(id).addClass("outputOn");
        $(id).removeClass("outputOff");
        } else {
        $(id).removeClass("outputOn");
        $(id).addClass("outputOff");
    };
};


// 文字列のtrue/falseを真偽値に変換する関数
function str2Bool(str){
    if (typeof str != "string") { 
        return Boolean(str); 
    }
    try {
        let obj = JSON.parse(str.toLowerCase());
        return obj == true;
    } catch(e) {
        return str != "";
    }
}
