package com.cricket.repository;

import com.cricket.repository.impl.ProcedureRepositoryImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Exercises the hand-written CallableStatement plumbing directly, using
 * Mockito to stand in for the JDBC driver. This is the part of the app that
 * cannot use Spring Data JPA (procedures with parameters and multiple result
 * sets), so it is the part most worth covering with a unit test.
 */
@ExtendWith(MockitoExtension.class)
class ProcedureRepositoryImplTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private Connection connection;
    @Mock private CallableStatement callableStatement;
    @Mock private ResultSet resultSet;
    @Mock private ResultSetMetaData metaData;

    private ProcedureRepositoryImpl procedureRepository;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        procedureRepository = new ProcedureRepositoryImpl(jdbcTemplate);

        doAnswer(invocation -> {
            ConnectionCallback<Object> callback = invocation.getArgument(0);
            return callback.doInConnection(connection);
        }).when(jdbcTemplate).execute(any(ConnectionCallback.class));

        when(connection.prepareCall(anyString())).thenReturn(callableStatement);
        when(callableStatement.getResultSet()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
    }

    @Test
    void listCountries_withBlankSearch_bindsSqlNull() throws Exception {
        when(callableStatement.execute()).thenReturn(true);
        when(metaData.getColumnCount()).thenReturn(2);
        when(metaData.getColumnLabel(1)).thenReturn("id");
        when(metaData.getColumnLabel(2)).thenReturn("name");
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getObject(1)).thenReturn("ind");
        when(resultSet.getObject(2)).thenReturn("India");

        List<Map<String, Object>> rows = procedureRepository.listCountries("");

        verify(callableStatement).setNull(1, Types.VARCHAR);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)).containsEntry("id", "ind").containsEntry("name", "India");
    }

    @Test
    void listCountries_withSearchTerm_bindsAsString() throws Exception {
        when(callableStatement.execute()).thenReturn(true);
        when(metaData.getColumnCount()).thenReturn(1);
        when(resultSet.next()).thenReturn(false);

        procedureRepository.listCountries("india");

        verify(callableStatement).setString(1, "india");
        verify(callableStatement, never()).setNull(eq(1), anyInt());
    }

    @Test
    void windowFunctionsDemo_readsEveryResultSetUntilExhausted() throws Exception {
        when(callableStatement.execute()).thenReturn(true);
        // 5 result sets, then getMoreResults() signals no more.
        when(callableStatement.getMoreResults()).thenReturn(true, true, true, true, false);
        when(metaData.getColumnCount()).thenReturn(1);
        when(resultSet.next()).thenReturn(false);

        Map<String, List<Map<String, Object>>> sections = procedureRepository.windowFunctionsDemo();

        assertThat(sections).containsKeys(
                "rankingWithinTeam", "cumulativeRunsByCountry", "teamTitleQuartiles",
                "lagLeadRuns", "firstLastValueByLeague");
        assertThat(sections).hasSize(5);
    }
}
