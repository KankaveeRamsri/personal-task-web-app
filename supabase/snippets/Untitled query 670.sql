select column_name
from information_schema.columns
where table_name = 'lists'
order by ordinal_position;