## TON Rocks Javascript API

TON Rocks Javascript API предназначен для доступа к сети TON Blockchain из браузера и Node.js с гарантиями целостности и валидности данных.

Архитектурно защищает от атаки "man-in-the-middle", а так же replay-атак, работает в децентрализованной манере, ввиду чего 
не имеет единой точки отказа.

Подключение к сети происходит напрямую к валидаторам либо полным нодам сети, с использованием протокола лайт-клиента.
Для возможности работы в браузере соединение осуществляется поверх протокола WebSocket.

API состоит из двух частей:
- BlockAPI - для работы с данными блокчейна,
- ContractAPI - для работы со смарт-контрактами.

Поддерживаются как классические смарт-контракты, написанные на fift/func (класс ClassicContract), так и ABIv2 контракты, написанные на solidity/c/c++ (класс AbiContract).

## Быстрый старт

1) Импорт библиотеки

в html:
```
<script src="/tonrocks.bundle.js"></script>
```
в js:
```
const TONRocks = require('tonweb');
```
2) Выбор конфига сети. В данном примере мы работаем в тестнете TON Rocks
```
const rocksTestnet = TonRocks.configs.RocksTestnet;
```
3) Загрузка данных, сохранённых ранее в Storage. Там хранятся валидированные блоки и известные узлы сети. Для работы с несколькими сетями в хранилище используется разделение данных по файл-хэшу зеростейта.
```
const storage = new TonRocks.storages.BrowserStorage(rocksTestnet.zero_state.filehashBase64());
storage.load();
storage.addBlock(rocksTestnet.zero_state);
```
Обратите внимание на добавление зеростейта к известным блокам. Валидация любого блока в сети происходит относительно уже известных блоков, поэтому при первом запуске необходим как минимум один. Разработчики могут добавить свой ключевой блок вместо зеростейта, с целью защиты от переписывания истории блокчейна.

4) Инициализация подсистемы смарт-контрактов
```
await TonRocks.Contract.init();
```
Здесь происходит инициализация Webassembly кода, поэтому функция должна вызываться, когда страница загружена.
Сделать это можно с помошью установки window.addEventListener на событие 'load'.

5) Подключение провайдера сети. На данный момент поддерживается только WebSocket провайдер.
```
const liteClient = new TonRocks.providers.LiteClient(rocksTestnet);
while (true) {
    const lastBlock = await liteClient.connect();
    if (lastBlock !== undefined) {
        console.log('connected. lastBlock:', lastBlock);
        break;
    }
}
```
Для корректного подключения на стороне клиента должно быть установлено правильное время. Это нужно для предотвращения
некоторых видов атак на пользователей.

6) Инициализация библиотеки. Провайдер и storage передаются аргументами.
```
const ton = new TonRocks(liteClient, storage);
```
7) Теперь основные API доступны через объект TonRocks либо переменную ton:

- BlockAPI object
```
let block = new TonRocks.bc.Block();
```
- AbiContract object
```
const sm = new TonRocks.AbiContract({
    abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
    keys: keyPair
});
```
## Примеры использования ABI контрактов.

Получение актуальных данных смарт-контракта происходит через BlockAPI. Локальное выполнение get-методов и подсчёт комиссии транзакции осуществляется в tvm, собранной в wasm.

Порядок работы с объектом AbiContract:
1. Создание seed фразы и пары ключей:
```
// create seed phrase
let mnemonic = TonRocks.utils.bip39.generateMnemonic();
console.log('New mnemonic:', mnemonic);

// convert 12 word mnemonic to 32 byte seed
let seed = await TonRocks.utils.bip39.mnemonicToSeed(mnemonic);
// get only 32 first bytes
seed = seed.subarray(0, 32);
console.log('private key:', TonRocks.utils.bytesToHex(seed));
    
// make key pair
const keyPair = TonRocks.utils.nacl.sign.keyPair.fromSeed(seed);
console.log('keyPair:', keyPair);
```
Как вариант можно работать с контрактом, имея только приватный ключ. Это нужно в тех случаях, когда ключ создавался из seed фразы по алгоритмам, отличным от bip39.
```
const privateKey = TonRocks.utils.hexToBytes('61828779dc419c5fc310eaf801b53a01fc76954ba70424f7ffb1877700c3b56a');
const publicKey = TonRocks.utils.hexToBytes('99fcb42751b75419213800dc6844813221136b249a21009abc66391f6c5ea2e8');

const keyPair = TonRocks.utils.nacl.sign.keyPair.fromSeed(seed);
console.log('keyPair', keyPair);

if (!TonRocks.utils.compareBytes(keyPair.publicKey, publicKey))
        throw Error('something went wrong');
```
2. Создание объекта смарт-контракта. Для создания нужен ABI пакет, содержащий описание интерфейса и код контракта.
```
const sm = new TonRocks.AbiContract({
    abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
    keys: keyPair
});
```
3.  Создание объекта деплоя
```
const smDeploy = await sm.deploy({
    wc: -1,
    input: {"owners":["0x" + TonRocks.utils.bytesToHex(keyPair.publicKey)], "reqConfirms":1},
    header: undefined,
    init: undefined
});
```
4. Объект деплоя предоставляет следующие возможности:
- получение адреса контракта
```
const smAddress = smDeploy.getAddress();
console.log('smAddress', smAddress.toString());
```
- получение сообщения деплоя для отправки в сеть
```
const smDeployMessage = await smDeploy.getMessage();
console.log('smDeployMessage', smDeployMessage);
```
- подсчёт комиссии операции деплоя
```
const smDeployFee = await smDeploy.estimateFee();
console.log('smDeployFee', smDeployFee);
```
- локальная эмуляция деплоя. Позволяет получить код и данные аккаунта, которые должны получится сразу после деплоя
```
const smDeployLocal = await smDeploy.runLocal();
console.log('smDeployLocal', smDeployLocal);
```
- выполнение деплоя в сети
```
const smDeployResult = await smDeploy.run();
console.log('smDeployResult', smDeployResult);
```
5. Объект любого смарт-контракта поддерживает следующие методы:
- получение актуального стейта аккаунта
```
const smAccount = await sm.getAccount();
console.log('smAccount', smAccount);
```
- получение списка транзакций 
```
// получение всех транзакций
const smTransactionsAll = await sm.getTransactions();
console.log('smTransactionsAll', smTransactionsAll);

// получение первых 3-х транзакций
const smTransactions3 = await sm.getTransactions(undefined, undefined, 3);
console.log('smTransactions3', smTransactions3);

// получение всех транзакций начиная с 4-й
const smTransactionsFrom = await sm.getTransactions(smTransactions3[smTransactions3.length-1].prev_trans_id);
console.log('smTransactionsFrom', smTransactionsFrom);
```
6. Помимо общих, есть так же специфические для контракта методы. Они условно делятся на меняющие и не меняющие стейт аккаунта. Последние называются get либо view-методами. Все методы ABI смарт-контракта находятся в списке methods:
```
console.log('methods', sm.methods);
```
7.  Get-методы могут вызываться без ключей к контракту:
```
const sm = new TonRocks.AbiContract({
    abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
    address: "-1:2f5a3cc56bc231a5ec8f7284010bb7962fe43d1bdd877c82076293160400af6"
});

// getCustodians method
const smGetCustodians = sm.methods.getCustodians();
const smGetCustodiansLocalResult = await smGetCustodians.runLocal();
console.log('smGetCustodiansLocalResult', smGetCustodiansLocalResult);

// getParameters method
const smGetParameters = sm.methods.getParameters();
const smGetParametersLocalResult = await smGetParameters.runLocal();
console.log('smGetParametersLocalResult', smGetParametersLocalResult);
```
7. Методы, изменяющие стейт аккаунта, могут выполняться как локально, так и в сети:
```
// создание объекта метода
const smSubmitTransaction = sm.methods.submitTransaction({
    input: {"dest":"-1:2f5a3cc56bc231a5ec8f7284010bb7962fe43d1bdd877c82076293160400af6c","value":1000000000,"bounce":true,"allBalance":false,"payload":"te6ccgEBAQEAAgAAAA=="},
    header: undefined
});

// получение сообщения операции
const smSubmitTransactionMessage = await smSubmitTransaction.getMessage();
console.log('smSubmitTransactionMessage', smSubmitTransactionMessage);

// вычисление комиссии операции
const smSubmitTransactionFee = await smSubmitTransaction.estimateFee();
console.log('smSubmitTransactionFee', smSubmitTransactionFee);

// локальная симуляция операции (с расчётом комиссии и состояния аккаунта после операции)
const smSubmitTransactionLocalResult = await smSubmitTransaction.runLocal({
    fullRun: true
});
console.log('smSubmitTransactionLocalResult', smSubmitTransactionLocalResult);

// выполнение операции в сети
const smSubmitTransactionResult = await smSubmitTransaction.run();
console.log('smSubmitTransactionResult', smSubmitTransactionResult);
```
