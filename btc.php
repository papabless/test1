"<?php
$intValue = 0;
$arrResult = json_decode(file_get_contents('http://preev.com/pulse/units:btc+usd/sources:bitfinex+bitstamp+btce'), true);
    foreach($arrResult['btc']['usd'] as $key => $index){
        $intValue = $intValue + $arrResult['btc']['usd'][$key]['last'];
    }
echo ($intValue / 3);
?>
